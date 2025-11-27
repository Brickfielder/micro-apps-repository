#!/usr/bin/env python3
from pathlib import Path
import shutil
import argparse
from bs4 import BeautifulSoup

COMMENT_BLOCK = """
<section id="clinician-notes">
  <div style="background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 16px; margin-top: 24px;">
    <label for="clinician-comment" style="display:block;font-weight:600;margin-bottom:8px;">
      Clinician comments (optional)
    </label>
    <textarea id="clinician-comment" rows="4" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--line); font: inherit; resize: vertical;"
      placeholder="Enter any notes relevant to this session..."></textarea>
    <p style="margin:8px 0 0; color: var(--muted); font-size: 0.9rem;">
      This note will be added as <code>clinician_comment</code> in the exported CSV.
    </p>
  </div>
</section>
""".strip()

def backup_file(p: Path):
    n = 0
    while True:
        bak = p.with_suffix(p.suffix + (".bak" if n == 0 else f".bak{n}"))
        if not bak.exists():
            shutil.copy2(p, bak)
            return bak
        n += 1

def ensure_head_body(soup: BeautifulSoup):
    if not soup.html:
        html = soup.new_tag("html", attrs={"lang":"en"})
        for ch in list(soup.contents):
            html.append(ch.extract())
        soup.append(html)
    if not soup.head:
        head = soup.new_tag("head")
        soup.html.insert(0, head)
    if not soup.body:
        body = soup.new_tag("body")
        soup.html.append(body)
    return soup.head, soup.body

def insert_once_head(soup: BeautifulSoup, head, tagname, attrs):
    if head.find(tagname, attrs=attrs):
        return False
    tag = soup.new_tag(tagname, attrs=attrs)
    head.append(tag)
    return True

def ensure_app_root(soup: BeautifulSoup):
    if soup.find(id="app-root"):
        return soup.find(id="app-root"), False
    # Create wrapper and move children
    wrapper = soup.new_tag("main", attrs={"id":"app-root"})
    for child in list(soup.body.children):
        wrapper.append(child.extract())
    soup.body.append(wrapper)
    return wrapper, True

def ensure_comment_block(root):
    if root.find(id="clinician-notes"):
        return False
    # append parsed fragment
    frag = BeautifulSoup(COMMENT_BLOCK, "html.parser")
    root.append(frag)
    return True

def process_file(p: Path, parser="lxml", dry=False):
    html = p.read_text(encoding="utf-8", errors="ignore")
    parser_name = "lxml" if parser=="lxml" else "html.parser"
    soup = BeautifulSoup(html, parser_name)

    head, body = ensure_head_body(soup)
    app_root, wrapped = ensure_app_root(soup)

    # Add shared CSV augmentation script
    ins_js = insert_once_head(soup, head, "script", {"src": "../shared/js/clinician_feedback.js", "defer": ""})

    # Add comment block
    added_block = ensure_comment_block(app_root)

    changed = ins_js or added_block or wrapped
    if not changed:
        return "skip (already ok)"

    if dry:
        return "DRY-RUN would modify"

    backup_file(p)
    p.write_text(str(soup), encoding="utf-8")
    return "updated"

def main():
    import argparse
    ap = argparse.ArgumentParser(description="Add clinician comment UI + CSV augmentation to all apps")
    ap.add_argument("--root", default="docs", help="Root containing apps (default: docs)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--parser", choices=["lxml","html"], default="lxml")
    args = ap.parse_args()

    root = Path(args.root)
    targets = []
    for idx in root.rglob("index.html"):
        rel = idx.relative_to(root)
        if rel.parts == ("index.html",):        # skip docs/index.html
            continue
        if "shared" in rel.parts:               # skip shared
            continue
        targets.append(idx)

    print(f"Scanning {len(targets)} index.html files under {root}…")
    for p in targets:
        try:
            status = process_file(p, parser=args.parser, dry=args.dry_run)
            print(f"{p}: {status}")
        except Exception as e:
            print(f"{p}: ERROR {type(e).__name__}: {e}")

if __name__ == "__main__":
    main()
