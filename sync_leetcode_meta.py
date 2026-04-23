from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent
META_FILE = ROOT / "problems_meta.json"
URLS_FILE = ROOT / "problem_urls.json"
GRAPHQL_URL = "https://leetcode.com/graphql/"

QUERY = """
query getQuestion($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title
    difficulty
    content
    topicTags {
      name
    }
  }
}
""".strip()


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def extract_slug(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    parts = [part for part in parsed.path.split("/") if part]
    if "problems" in parts:
        problem_index = parts.index("problems")
        if problem_index + 1 < len(parts):
            return parts[problem_index + 1]
    raise ValueError(f"Could not extract slug from URL: {url}")


def fetch_question(slug: str) -> dict:
    payload = json.dumps(
        {
            "query": QUERY,
            "variables": {"titleSlug": slug},
            "operationName": "getQuestion",
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        GRAPHQL_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Referer": f"https://leetcode.com/problems/{slug}/",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        body = json.loads(response.read().decode("utf-8"))

    if body.get("errors"):
        raise RuntimeError(f"GraphQL errors for {slug}: {body['errors']}")

    question = body.get("data", {}).get("question")
    if not question:
        raise RuntimeError(f"No question returned for slug: {slug}")

    return question


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def html_to_text(html: str) -> str:
    text = html
    replacements = [
        ("<br>", "\n"),
        ("<br/>", "\n"),
        ("<br />", "\n"),
        ("</p>", "\n\n"),
        ("</div>", "\n"),
        ("</li>", "\n"),
        ("</ul>", "\n"),
        ("</ol>", "\n"),
        ("</pre>", "\n"),
        ("</h1>", "\n\n"),
        ("</h2>", "\n\n"),
        ("</h3>", "\n\n"),
        ("</h4>", "\n\n"),
    ]
    for source, target in replacements:
        text = text.replace(source, target)

    text = re.sub(r"<li[^>]*>", "- ", text)
    text = re.sub(r"<pre[^>]*>", "", text)
    text = re.sub(r"<code[^>]*>", "`", text)
    text = re.sub(r"</code>", "`", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_section_lines(text: str, heading: str) -> list[str]:
    pattern = re.compile(
        rf"(?:^|\n){re.escape(heading)}\s*\n(?P<body>.*?)(?=\n[A-Z][^\n]*\n|\Z)",
        re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        return []

    lines = []
    for raw_line in match.group("body").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("- "):
            line = line[2:].strip()
        lines.append(collapse_whitespace(line))
    return lines


def extract_examples(text: str) -> list[str]:
    matches = re.findall(
        r"(Example\s*\d*:?\s*.*?)(?=Example\s*\d*:|\nConstraints\s*\n|\Z)",
        text,
        re.DOTALL,
    )
    examples = []
    for match in matches:
        cleaned = re.sub(r"\n{3,}", "\n\n", match).strip()
        if cleaned:
            examples.append(cleaned)
    return examples


def sync_meta() -> None:
    meta = load_json(META_FILE)
    urls = load_json(URLS_FILE)

    for problem_id, url in urls.items():
        slug = extract_slug(url)
        question = fetch_question(slug)
        text_content = html_to_text(question["content"] or "")

        entry = meta.setdefault(problem_id, {})
        entry["title"] = question["title"] or entry.get("title", f"Problem {problem_id}")
        entry["difficulty"] = question["difficulty"] or entry.get("difficulty", "Unknown")
        entry["tags"] = [tag["name"] for tag in question.get("topicTags", [])] or entry.get("tags", [])
        entry["statementHtml"] = question["content"] or ""
        entry["statement"] = text_content.split("Example 1")[0].strip() if "Example 1" in text_content else text_content
        entry["examples"] = extract_examples(text_content) or entry.get("examples", [])
        entry["constraints"] = extract_section_lines(text_content, "Constraints") or entry.get("constraints", [])
        entry["sourceUrl"] = url

        print(f"Synced #{problem_id} {entry['title']}")

    META_FILE.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    try:
        sync_meta()
    except urllib.error.URLError as exc:
        raise SystemExit(f"Network error: {exc}") from exc
