import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_valid_square_area():
    # ~1.2 ha parcel in Karnataka
    payload = {
        "polygon": [
            [75.7500, 13.3200],
            [75.7510, 13.3200],
            [75.7510, 13.3210],
            [75.7500, 13.3210],
            [75.7500, 13.3200]
        ]
    }
    response = client.post("/api/v1/field/area", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["polygon_valid"] is True
    assert 1.0 < data["area_ha"] < 1.5
    assert data["area_method"] == "geodesic"
    assert "centroid" in data
    assert "perimeter_m" in data

def test_bowtie_self_intersecting():
    # Bow-tie polygon
    payload = {
        "polygon": [
            [75.7500, 13.3200],
            [75.7510, 13.3210],
            [75.7500, 13.3210],
            [75.7510, 13.3200],
            [75.7500, 13.3200]
        ]
    }
    response = client.post("/api/v1/field/area", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] == "SELF_INTERSECTION"

def test_too_few_vertices():
    payload = {
        "polygon": [
            [75.7500, 13.3200],
            [75.7510, 13.3200]
        ]
    }
    response = client.post("/api/v1/field/area", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] in ["TOO_FEW_VERTICES", "NOT_CLOSED"]

def test_area_too_small():
    # Micro polygon (< 0.01 ha)
    payload = {
        "polygon": [
            [75.75000, 13.32000],
            [75.75001, 13.32000],
            [75.75001, 13.32001],
            [75.75000, 13.32001],
            [75.75000, 13.32000]
        ]
    }
    response = client.post("/api/v1/field/area", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] == "TOO_SMALL"

def test_area_too_large():
    # Huge polygon > 1000 ha (e.g. 1° x 1° is ~1.2 million ha)
    payload = {
        "polygon": [
            [75.0, 13.0],
            [76.0, 13.0],
            [76.0, 14.0],
            [75.0, 14.0],
            [75.0, 13.0]
        ]
    }
    response = client.post("/api/v1/field/area", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] == "TOO_LARGE"

def test_point_only():
    payload = {
        "point": [75.75, 13.32]
    }
    response = client.post("/api/v1/field/area", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["area_ha"] is None
    assert data["polygon_valid"] is False
    assert data["centroid"] == [75.75, 13.32]
