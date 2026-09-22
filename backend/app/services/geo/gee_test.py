"""
GEE authentication and connectivity smoke test script.
Checks if GEE credentials exist or gracefully falls back to mock mode.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

def test_gee_connection() -> dict:
    service_account = os.getenv("GEE_SERVICE_ACCOUNT", "")
    key_path = os.getenv("GEE_PRIVATE_KEY_PATH", "")
    mock_fallback = os.getenv("GEE_MOCK_FALLBACK", "true").lower() == "true"

    if not service_account or not key_path or not os.path.exists(key_path):
        if mock_fallback:
            return {
                "status": "mock_fallback",
                "message": "GEE credentials not provided or key file missing. Using synthetic GEE mock mode."
            }
        else:
            return {
                "status": "error",
                "message": "GEE credentials missing and fallback disabled."
            }

    try:
        import ee
        import json
        project_id = os.getenv("GEE_PROJECT_ID", "")
        if not project_id and os.path.exists(key_path):
            try:
                with open(key_path) as f:
                    project_id = json.load(f).get("project_id", "")
            except Exception:
                pass

        credentials = ee.ServiceAccountCredentials(service_account, key_path)
        if project_id:
            ee.Initialize(credentials, project=project_id)
        else:
            ee.Initialize(credentials)
        return {
            "status": "connected",
            "message": "Successfully authenticated and initialized Google Earth Engine."
        }
    except Exception as e:
        if mock_fallback:
            return {
                "status": "mock_fallback",
                "message": f"GEE connection error ({str(e)}). Falling back to synthetic GEE mock mode."
            }
        return {
            "status": "error",
            "message": f"GEE initialization failed: {str(e)}"
        }

if __name__ == "__main__":
    result = test_gee_connection()
    print(f"GEE Status: {result['status']}")
    print(f"Message: {result['message']}")
