#!/usr/bin/env python3
"""
Fail if a CSS class used in the React code has no rule in any stylesheet.
Run from the repo root:  python scripts/audit_css_classes.py
"""
import re, sys
from pathlib import Path

SRC = Path("frontend/src")
# Classes built at runtime from a prefix (e.g. `ui-btn-${variant}`): checked by the Playwright run instead.
DYNAMIC_PREFIXES = ("ui-btn-", "ui-badge-", "ui-toast-", "ui-icon-btn-", "badge-", "rank-", "detection-badge-")

css = "".join(p.read_text(errors="ignore") for p in SRC.rglob("*.css"))
defined = set(re.findall(r"\.([A-Za-z_][\w-]*)", css))

used = {}
for p in SRC.rglob("*.tsx"):
    text = p.read_text(errors="ignore")
    for m in re.finditer(r'className=(?:"([^"]+)"|\{`([^`]+)`\})', text):
        raw = re.sub(r"\$\{[^}]*\}", " ", m.group(1) or m.group(2))
        for c in raw.split():
            if re.fullmatch(r"[A-Za-z_][\w-]*", c) and c not in DYNAMIC_PREFIXES:
                used.setdefault(c, set()).add(p.name)

missing = {c: f for c, f in used.items() if c not in defined}
for c in sorted(missing):
    print(f"MISSING  .{c:36s} {', '.join(sorted(missing[c]))}")
print(f"\n{len(used)} classes used, {len(missing)} without a rule")
sys.exit(1 if missing else 0)
