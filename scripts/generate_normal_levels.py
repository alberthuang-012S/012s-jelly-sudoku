"""Legacy entry point; rebuild the complete catalogue with the shared game engine."""
import subprocess
from pathlib import Path

subprocess.run(["node", "scripts/generate_catalogue.mjs"], cwd=Path(__file__).resolve().parent.parent, check=True)
