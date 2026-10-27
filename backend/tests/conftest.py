"""
Pytest configuration for backend test suite (PRD v3.1 §6 B7).
Enforces offline testing with socket blocking fixture.
Stubs remote readers and external providers so all tests execute offline in < 3 minutes.
"""
import pytest
from pytest_socket import disable_socket, enable_socket

@pytest.fixture(autouse=True, scope="session")
def block_network_sockets():
    """Disable all outbound TCP/UDP sockets for offline test isolation."""
    disable_socket(allow_unix_socket=True)

@pytest.fixture(autouse=True)
def handle_network_marker(request):
    """Enable sockets only for tests explicitly marked with @pytest.mark.network."""
    if "network" in request.keywords:
        enable_socket()
        yield
        disable_socket(allow_unix_socket=True)
    else:
        yield
