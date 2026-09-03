"""
Season Normalization Module.
Maps Indian agricultural season strings to standardized canonical seasons:
"kharif", "rabi", "zaid", "annual", "perennial".
"""

SEASON_MAP = {
    "kharif": "kharif",
    "autumn": "kharif",
    "monsoon": "kharif",
    "summer_monsoon": "kharif",

    "rabi": "rabi",
    "winter": "rabi",

    "zaid": "zaid",
    "summer": "zaid",
    "pre-monsoon": "zaid",

    "annual": "annual",
    "whole year": "annual",
    "year-round": "annual",

    "perennial": "perennial",
    "multi-year": "perennial"
}

def normalize_season(season_str: str) -> str:
    """Normalizes season input into standard canonical string."""
    clean = season_str.strip().lower()
    return SEASON_MAP.get(clean, "kharif")
