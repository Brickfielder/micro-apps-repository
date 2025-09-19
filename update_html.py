#!/usr/bin/env python3
from pathlib import Path
import shutil
import argparse
from bs4 import BeautifulSoup

def backup_file(p: Path):
    n = 0
    while True:
        bak = p.with_suffix(p.suffix + (".bak" if n == 0 else f".bak{n}"))
        if not bak.exists():
            shutil.copy2(p, bak)
            return bak
        n += 1

def restore_backup(p: Path):
    c = sorted(p.parent.glob(p.name + ".bak*"), key=lambda x: x.stat().st_mtime, reverse=True)
    if c:
        shutil.copy2(c[0], p)
        return c[0]
    return None

def ensure_head_body(soup: BeautifulSoup):
    # Ensure <html>
    if not soup.html:
        html = soup.new_tag("html", attrs={"lang": "en"})
        # Move everything into <html>
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

def insert_once_head(soup: BeautifulSoup, head, tagname, attrs):
    # idempotent insert: only if a matching tag doesn’t exist
    if head.find(tagname, attrs=attrs):
        return False
    new = soup.new_tag(tagname, attrs=attrs)  # <- always via soup.new_tag
    head.append(new)
    return True

def wrap_app_root(soup: BeautifulSoup):
    if soup.find(id="app-root"):
        return False
    body = soup.body
    wrapper = soup.new_tag("main", attrs={"id": "app-root"})
    for child in list(body.children):
        wrapper.append(child.extract())
    body.append(wrapper)
    return True

def process_index(index_path: Path, dry=False):
    html = index_path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(html, "lxml")  # ok if you have lxml; else use "html.parser"
    head, body = ensure_head_body(soup)

    app_slug = index_path.parent.name

    # meta app-slug
    inserted_meta = False
    if not head.find("meta", attrs={"name": "app-slug"}):
        meta = soup.new_tag("meta", attrs={"name": "app-slug", "content": app_slug})
        head.append(meta)
        inserted_meta = True

    # shared CSS/JS (use empty string for boolean attrs like 'defer')
    ins_css = insert_once_head(soup, head, "link", {"rel": "stylesheet", "href": "/shared/theme.css"})
    ins_js  = insert_once_head(soup, head, "script", {"src": "/shared/frame.js", "defer": ""})

    wrapped = wrap_app_root(soup)
    changed = inserted_meta or ins_css or ins_js or wrapped
    if not changed:
        return "skip (already ok)"
    if dry:
        return "DRY-RUN would modify"

    backup_file(index_path)
    index_path.write_text(str(soup), encoding="utf-8")
    return "updated"

def main():
    ap = argparse.ArgumentParser(description="Unify headers for Micro Apps in docs/")
    ap.add_argument("--root", default="docs", help="Root folder (default: docs)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--undo", action="store_true")
    ap.add_argument("--parser", choices=["lxml","html"], default="lxml")
    args = ap.parse_args()

    root = Path(args.root)
    if not root.exists():
        print(f"Root '{root}' not found. Run from repo root or pass --root.")
        return

    candidates = []
    for p in root.rglob("index.html"):
        rel = p.relative_to(root)
        if rel.parts == ("index.html",):        # docs/index.html
            continue
        if "shared" in rel.parts:               # skip shared assets
            continue
        candidates.append(p)

    if args.undo:
        print("Restoring from backups where present…")
        for idx in candidates:
            bak = restore_backup(idx)
            print(f"{idx}: {'restored ' + bak.name if bak else 'no backup found'}")
        return

    print(f"Scanning {len(candidates)} index.html files under {root}…")
    for idx in candidates:
        try:
            status = process_index(idx, dry=args.dry_run)
            print(f"{idx}: {status}")
        except Exception as e:
            # surface useful context
            print(f"{idx}: ERROR {type(e).__name__}: {e}")

if __name__ == "__main__":
    main()
