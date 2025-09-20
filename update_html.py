#!/usr/bin/env python3
"""
Unify Micro Apps header/theme across all apps under docs/.

Inserts (idempotently) into each docs/<app>/index.html:
  - <meta name="app-slug" content="<folder>">
  - <link rel="stylesheet" href="../shared/theme.css">
  - <script defer src="../shared/frame.js"></script>

Also ensures <html>, <head>, <body>, and wraps body content in:
  <main id="app-root"> ... </main>

Creates .bak backups and supports --dry-run and --undo.
"""

from pathlib import Path
import shutil
import argparse
from bs4 import BeautifulSoup

# --------------------------- backup helpers ---------------------------

def backup_file(p: Path):
    """Create next available .bak(.N) next to file p."""
    n = 0
    while True:
        candidate = p.with_suffix(p.suffix + (".bak" if n == 0 else f".bak{n}"))
        if not candidate.exists():
            shutil.copy2(p, candidate)
            return candidate
        n += 1

def restore_latest_backup(p: Path):
    """Restore most recent .bak* if present."""
    backups = sorted(p.parent.glob(p.name + ".bak*"),
                     key=lambda x: x.stat().st_mtime,
                     reverse=True)
    if backups:
        shutil.copy2(backups[0], p)
        return backups[0]
    return None

# --------------------------- DOM helpers ------------------------------

def ensure_head_body(soup: BeautifulSoup):
    # Ensure <html>
    if not soup.html:
        html = soup.new_tag("html", attrs={"lang": "en"})
        for child in list(soup.contents):
            html.append(child.extract())
        soup.append(html)
    # Ensure <head>
    if not soup.head:
        head = soup.new_tag("head")
        soup.html.insert(0, head)
    # Ensure <body>
    if not soup.body:
        body = soup.new_tag("body")
        soup.html.append(body)
    return soup.head, soup.body

def insert_once_in_head(soup: BeautifulSoup, head, tagname: str, attrs: dict):
    """Insert tag into <head> if not already present. Returns True if inserted."""
    if head.find(tagname, attrs=attrs):
        return False
    tag = soup.new_tag(tagname, attrs=attrs)  # always via soup.new_tag
    head.append(tag)
    return True

def wrap_app_root(soup: BeautifulSoup):
    """Wrap existing body children in <main id="app-root"> if missing."""
    if soup.find(id="app-root"):
        return False
    wrapper = soup.new_tag("main", attrs={"id": "app-root"})
    for child in list(soup.body.children):
        wrapper.append(child.extract())
    soup.body.append(wrapper)
    return True

# --------------------------- main transform ---------------------------

def process_index(index_path: Path, parser: str, dry: bool):
    html = index_path.read_text(encoding="utf-8", errors="ignore")
    parser_name = "lxml" if parser == "lxml" else "html.parser"
    soup = BeautifulSoup(html, parser_name)

    head, body = ensure_head_body(soup)

    # meta app-slug (folder name)
    app_slug = index_path.parent.name
    inserted_meta = False
    if not head.find("meta", attrs={"name": "app-slug"}):
        meta = soup.new_tag("meta", attrs={"name": "app-slug", "content": app_slug})
        head.append(meta)
        inserted_meta = True

    # shared CSS + JS (relative one level up)
    ins_css = insert_once_in_head(
        soup, head, "link",
        {"rel": "stylesheet", "href": "../shared/theme.css"}
    )
    # boolean attr defer as empty string renders correctly
    ins_js = insert_once_in_head(
        soup, head, "script",
        {"src": "../shared/frame.js", "defer": ""}
    )

    wrapped = wrap_app_root(soup)

    changed = inserted_meta or ins_css or ins_js or wrapped
    if not changed:
        return "skip (already ok)"

    if dry:
        return "DRY-RUN would modify"

    backup_file(index_path)
    index_path.write_text(str(soup), encoding="utf-8")
    return "updated"

# --------------------------- CLI -------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Standardize app headers in docs/")
    ap.add_argument("--root", default="docs", help="Root containing apps (default: docs)")
    ap.add_argument("--dry-run", action="store_true", help="Show actions but do not write")
    ap.add_argument("--undo", action="store_true", help="Restore latest .bak for each file")
    ap.add_argument("--parser", choices=["lxml", "html"], default="lxml",
                    help="HTML parser to use (default: lxml)")
    args = ap.parse_args()

    root = Path(args.root)
    if not root.exists():
        print(f"Root '{root}' not found. Run from repo root or pass --root.")
        return

    # Find index.html under docs/** but skip docs/index.html and docs/shared/**
    candidates = []
    for p in root.rglob("index.html"):
        rel = p.relative_to(root)
        if rel.parts == ("index.html",):
            continue
        if "shared" in rel.parts:
            continue
        candidates.append(p)

    if args.undo:
        print("Restoring from backups (if present)…")
        for idx in candidates:
            bak = restore_latest_backup(idx)
            print(f"{idx}: {'restored ' + bak.name if bak else 'no backup found'}")
        return

    print(f"Scanning {len(candidates)} index.html files under {root}…")
    for idx in candidates:
        try:
            status = process_index(idx, parser=args.parser, dry=args.dry_run)
            print(f"{idx}: {status}")
        except Exception as e:
            print(f"{idx}: ERROR {type(e).__name__}: {e}")

if __name__ == "__main__":
    main()
