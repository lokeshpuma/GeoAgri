"""
Tests for /api/v1/map-layers honest status reporting (PRD v2.1 M10, M24).
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_map_layers_endpoint():
    response = client.get("/api/v1/map-layers")
    assert response.status_code == 200
    data = response.json()

    assert "layers" in data
    assert "total_layers" in data
    assert "ready_count" in data
    assert "unavailable_count" in data
    assert data["total_layers"] == len(data["layers"])
    assert data["total_layers"] >= 8

    # Check structure of each layer
    for layer in data["layers"]:
        assert "id" in layer
        assert "name" in layer
        assert "status" in layer
        assert layer["status"] in ["ready", "unavailable"]
        assert "licence" in layer
        if layer["status"] == "unavailable":
            assert layer["reason"] is not None and len(layer["reason"]) > 0
