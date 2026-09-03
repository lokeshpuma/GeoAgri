"""
Dataset Loader & Exception Guards.
Implements explicit EmptyDatasetError guard when attempting to read empty crop_production.csv file.
"""

import os
import pandas as pd

class EmptyDatasetError(ValueError):
    """Raised when an empty or corrupted dataset is loaded."""
    pass

def load_csv_dataset(filepath: str) -> pd.DataFrame:
    """Loads a CSV file after checking for existence and non-zero size."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Dataset file not found: {filepath}")
    
    if os.path.getsize(filepath) == 0:
        raise EmptyDatasetError(f"Dataset file is empty (0 bytes): {filepath}")
    
    try:
        df = pd.read_csv(filepath)
        if df.empty:
            raise EmptyDatasetError(f"Dataset dataframe contains no rows: {filepath}")
        return df
    except pd.errors.EmptyDataError:
        raise EmptyDatasetError(f"Pandas failed to parse empty dataset: {filepath}")
