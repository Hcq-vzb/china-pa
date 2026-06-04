#!/usr/bin/env python3
"""Extract, download, and localize images for naboplastic static mirror."""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE_URL = "https://www.naboplastic.com/"
UPLOADS_PREFIX = "wp-content/uploads/"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".avif"}

# Match absolute or relative upload paths ending in image extensions
ABS_PATTERN = re.compile(
    r"https?://(?:www\.)?naboplastic\.com/(wp-content/uploads/[^\s\"'<>)]+\.(?:jpg|jpeg|png|gif|webp|svg|ico|avif))",
    re.IGNORECASE,
)
REL_PATTERN = re.compile(
    r"(?<![/\w])(wp-content/uploads/[^\s\"'<>)]+\.(?:jpg|jpeg|png|gif|webp|svg|ico|avif))",
    re.IGNORECASE,
)
CSS_URL_PATTERN = re.compile(
    r"url\(['\"]?(https?://(?:www\.)?naboplastic\.com/)?(wp-content/uploads/[^)'\"]+\.(?:jpg|jpeg|png|gif|webp|svg|ico|avif))['\"]?\)",
    re.IGNORECASE,
)


def collect_image_paths() -> set[str]:
    paths: set[str] = set()
    scan_ext = {".html", ".css", ".js", ".json"}

    for fp in ROOT.rglob("*"):
        if not fp.is_file() or fp.suffix.lower() not in scan_ext:
            continue
        if "tools" in fp.parts:
            continue
        try:
            text = fp.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        for m in ABS_PATTERN.finditer(text):
            paths.add(m.group(1).replace("\\", "/"))
        for m in REL_PATTERN.finditer(text):
            paths.add(m.group(1).replace("\\", "/"))
        for m in CSS_URL_PATTERN.finditer(text):
            paths.add(m.group(2).replace("\\", "/"))

    return paths


def download_one(rel_path: str, retries: int = 3) -> tuple[str, str]:
    """Return (rel_path, status) where status is ok|skip|fail."""
    local = ROOT / rel_path.replace("/", os.sep)
    if local.exists() and local.stat().st_size > 0:
        return rel_path, "skip"

    local.parent.mkdir(parents=True, exist_ok=True)
    url = BASE_URL + rel_path

    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) StaticMirror/1.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            if len(data) < 50:
                return rel_path, "fail:empty"
            local.write_bytes(data)
            return rel_path, "ok"
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return rel_path, f"fail:404"
            if attempt == retries - 1:
                return rel_path, f"fail:{e.code}"
        except Exception as e:
            if attempt == retries - 1:
                return rel_path, f"fail:{type(e).__name__}"
        time.sleep(0.5 * (attempt + 1))

    return rel_path, "fail"


def localize_html_files() -> int:
    """Replace absolute naboplastic upload URLs with relative paths."""
    changed = 0
    for fp in ROOT.rglob("*.html"):
        if "tools" in fp.parts:
            continue
        try:
            text = fp.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        new_text = ABS_PATTERN.sub(r"\1", text)
        new_text = re.sub(
            r"https?://(?:www\.)?naboplastic\.com/(wp-content/uploads/)",
            r"wp-content/uploads/",
            new_text,
            flags=re.IGNORECASE,
        )
        if new_text != text:
            fp.write_text(new_text, encoding="utf-8")
            changed += 1
    return changed


def main():
    print(f"Root: {ROOT}")
    print("Scanning files for image references...")
    paths = sorted(collect_image_paths())
    print(f"Found {len(paths)} unique image paths")

    # Save manifest
    manifest_dir = ROOT / "tools"
    manifest_dir.mkdir(exist_ok=True)
    manifest_path = manifest_dir / "image-manifest.json"
    manifest_path.write_text(json.dumps(paths, indent=2), encoding="utf-8")

    existing = sum(1 for p in paths if (ROOT / p).exists())
    missing = [p for p in paths if not (ROOT / p).exists()]
    print(f"Already local: {existing}, need download: {len(missing)}")

    if not missing:
        print("All images already present.")
    else:
        workers = min(8, max(2, len(missing) // 50))
        print(f"Downloading with {workers} workers...")
        stats = {"ok": 0, "skip": 0, "fail": 0}
        failures: list[str] = []

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(download_one, p): p for p in missing}
            done = 0
            total = len(missing)
            for fut in as_completed(futures):
                rel, status = fut.result()
                done += 1
                if status == "ok":
                    stats["ok"] += 1
                elif status == "skip":
                    stats["skip"] += 1
                else:
                    stats["fail"] += 1
                    failures.append(f"{rel} -> {status}")
                if done % 100 == 0 or done == total:
                    print(f"  Progress: {done}/{total} (ok={stats['ok']}, fail={stats['fail']})")

        print(f"Download complete: ok={stats['ok']}, skip={stats['skip']}, fail={stats['fail']}")
        if failures:
            fail_log = manifest_dir / "download-failures.txt"
            fail_log.write_text("\n".join(failures[:500]), encoding="utf-8")
            print(f"Failure log: {fail_log} ({len(failures)} entries)")

    print("Localizing absolute image URLs in HTML...")
    html_changed = localize_html_files()
    print(f"Updated {html_changed} HTML files")

    # Summary by year folder
    by_year: dict[str, int] = {}
    for p in paths:
        parts = p.split("/")
        key = "/".join(parts[:4]) if len(parts) >= 4 else p
        by_year[key] = by_year.get(key, 0) + 1
    print("\nImages by upload folder (top 15):")
    for k, v in sorted(by_year.items(), key=lambda x: -x[1])[:15]:
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
