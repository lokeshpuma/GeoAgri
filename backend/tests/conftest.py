"""
Pytest configuration for backend test suite (PRD v3.1 §6 B7).
Enforces offline testing with socket blocking fixture.
Stubs remote readers and external providers so all tests execute offline in < 3 minutes.
"""
import pytest
from pytest_socket import disable_socket, enable_socket
from app.core.config import get_settings

@pytest.fixture(autouse=True, scope="session")
def block_network_sockets():
    """Disable all outbound TCP/UDP sockets for offline test isolation."""
    disable_socket(allow_unix_socket=True)

@pytest.fixture(autouse=True)
def test_environment_settings(monkeypatch):
    """
    Ensure offline tests run with mock fallback and synthetic data enabled
    even in clean environments with no .env file (PRD v3.2 §3 T2).
    """
    monkeypatch.setenv("GEE_MOCK_FALLBACK", "true")
    monkeypatch.setenv("ALLOW_SYNTHETIC_DATA", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()

@pytest.fixture(autouse=True)
def handle_network_marker(request):
    """Enable sockets only for tests explicitly marked with @pytest.mark.network."""
    if "network" in request.keywords:
        enable_socket()
        yield
        disable_socket(allow_unix_socket=True)
    else:
        yield
