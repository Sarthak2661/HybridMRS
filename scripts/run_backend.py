from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SURPRISE_DIR = PROJECT_ROOT / ".surprise_data"
sys.path.insert(0, str(PROJECT_ROOT))


def main() -> None:
    os.environ.setdefault("SURPRISE_DATA_FOLDER", str(DEFAULT_SURPRISE_DIR))
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(
        "app.backend.main:app",
        host=host,
        port=port,
        reload=False,
    )


if __name__ == "__main__":
    main()
