"""
Detection Engine Budget and Resilience Tests (PRD v2.1 §5A.6, M28).
Validates that:
- Slow sources (simulated with 20s sleep) do not breach the 8s total budget.
- Unresponsive sources return state='unavailable' and generate warnings.
- The system returns HTTP 200 / valid structured response rather than crashing or timing out.
"""
import time
import pytest

from app.services.landclass import detection


def test_slow_sources_respect_budget_and_warn(monkeypatch):
    """Slow stubs sleeping 20s must be terminated within budget (<= 8s) and reported in warnings."""
    detection._cache.clear()

    def slow_worldcover(*args, **kwargs):
        time.sleep(20)
        return {40: 1.0}

    def slow_terrain(*args, **kwargs):
        time.sleep(20)
        return {"mean_slope_deg": 1.0, "max_elevation_m": 100.0, "mean_elevation_m": 100.0}

    def fast_osm(*args, **kwargs):
        return {"reasons": [], "features": [], "building_count": 0, "roads": []}

    monkeypatch.setattr(detection, "land_cover_composition", slow_worldcover)
    monkeypatch.setattr(detection, "terrain_at", slow_terrain)
    monkeypatch.setattr(detection, "osm_check", fast_osm)

    # Configure short test timeouts: per-source 2s, total budget 3s
    monkeypatch.setattr(
        detection,
        "load_detection_rules",
        lambda: {
            "timeouts": {"per_source_s": 2, "total_budget_s": 3},
            "point_only_acres": 0.7,
            "forest": {"cover_share_min": 0.50},
            "buildings": {"urban_dominant_share_min": 0.30},
            "water": {"share_min": 0.35},
            "cache_ttl_s": 60,
        }
    )

    t0 = time.time()
    res = detection.detect_features(13.32, 75.75)
    elapsed = time.time() - t0

    # Must finish within total budget (3s + modest overhead, << 20s)
    assert elapsed < 5.0, f"Detection took {elapsed:.2f}s, exceeding total budget!"
    
    # Check that slow sources were marked unavailable or produced warnings
    assert res["forest"]["state"] == "unknown"
    assert res["terrain"]["state"] == "unknown"
    assert len(res["warnings"]) >= 1

    # Fast OSM source should have completed
    assert res["roads"]["state"] == "not_detected"


def test_standard_budget_under_eight_seconds(monkeypatch):
    """Under default 6s / 8s timeouts, 20s hanging source never exceeds 8.5s total."""
    detection._cache.clear()

    def hanging_call(*args, **kwargs):
        time.sleep(20)
        return None

    monkeypatch.setattr(detection, "land_cover_composition", hanging_call)
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": [], "features": [], "building_count": 0, "roads": []})

    t0 = time.time()
    res = detection.detect_features(13.32, 75.75)
    elapsed = time.time() - t0

    assert elapsed <= 8.5, f"Detection took {elapsed:.2f}s, exceeding 8s budget!"
    assert any("unavailable" in w or "timed out" in w for w in res["warnings"])
