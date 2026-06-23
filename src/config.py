"""
Global configuration for the Hybrid MRS project.

Defines folder structure and key dataset paths so that all other modules
can import from here instead of hard-coding file locations.
"""

# Project root = Hybrid MRS folder
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Data directories
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"

# Raw dataset roots
ML32M_DIR = RAW_DATA_DIR / "ml-32m"
GENOME2021_DIR = RAW_DATA_DIR / "genome_2021"

# MovieLens 32M CSVs
ML32M_RATINGS = ML32M_DIR / "ratings.csv"
ML32M_MOVIES = ML32M_DIR / "movies.csv"
ML32M_TAGS = ML32M_DIR / "tags.csv"      # ✔ correct file
ML32M_LINKS = ML32M_DIR / "links.csv"    # ✔ correct file

# Genome 2021 JSON files
GENOME_METADATA = GENOME2021_DIR / "metadata.json"
GENOME_METADATA_UPDATED = GENOME2021_DIR / "metadata_updated.json"
GENOME_RATINGS = GENOME2021_DIR / "ratings.json"
GENOME_REVIEWS = GENOME2021_DIR / "reviews.json"
GENOME_SURVEY_ANSWERS = GENOME2021_DIR / "survey_answers.json"
GENOME_TAG_COUNT = GENOME2021_DIR / "tag_count.json"
GENOME_TAGS = GENOME2021_DIR / "tags.json"
