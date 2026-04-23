from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
OUTPUT_FILE = DATA_DIR / "problems.json"
META_FILE = ROOT / "problems_meta.json"
URLS_FILE = ROOT / "problem_urls.json"

IGNORED_DIRS = {".git", ".venv", "assets", "data", "__pycache__"}


def load_meta() -> dict[str, dict]:
    if not META_FILE.exists():
        return {}
    return json.loads(META_FILE.read_text(encoding="utf-8"))


def load_urls() -> dict[str, str]:
    if not URLS_FILE.exists():
        return {}
    return json.loads(URLS_FILE.read_text(encoding="utf-8"))


def make_title(problem_id: str, meta: dict[str, dict]) -> str:
    entry = meta.get(problem_id, {})
    return entry.get("title", f"Problem {problem_id}")


def build_problem_record(path: Path, category: str, meta: dict[str, dict]) -> dict:
    problem_id = path.stem
    entry = meta.get(problem_id, {})
    return {
        "id": problem_id,
        "title": make_title(problem_id, meta),
        "category": category,
        "difficulty": entry.get("difficulty", "Unknown"),
        "tags": entry.get("tags", [category]),
        "notes": entry.get("notes", ""),
        "statement": entry.get("statement", ""),
        "statementHtml": entry.get("statementHtml", ""),
        "examples": entry.get("examples", []),
        "constraints": entry.get("constraints", []),
        "sourceUrl": entry.get("sourceUrl", ""),
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "language": "Python",
        "solution": path.read_text(encoding="utf-8"),
    }


def collect_problems() -> tuple[list[dict], dict[str, int]]:
    meta = load_meta()
    urls = load_urls()
    problems: list[dict] = []
    counts: defaultdict[str, int] = defaultdict(int)

    for child in sorted(ROOT.iterdir()):
        if not child.is_dir() or child.name in IGNORED_DIRS:
            continue

        category = child.name
        for problem_file in sorted(child.glob("*.py"), key=lambda p: int(p.stem)):
            problem_id = problem_file.stem
            if problem_id in urls:
                meta.setdefault(problem_id, {})
                meta[problem_id]["sourceUrl"] = urls[problem_id]
            problems.append(build_problem_record(problem_file, category, meta))
            counts[category] += 1

    problems.sort(key=lambda item: int(item["id"]))
    return problems, dict(sorted(counts.items()))


def write_output() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    problems, category_counts = collect_problems()
    payload = {
        "summary": {
            "problemCount": len(problems),
            "categoryCount": len(category_counts),
            "language": "Python",
        },
        "categoryCounts": category_counts,
        "problems": problems,
    }
    OUTPUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    write_output()
