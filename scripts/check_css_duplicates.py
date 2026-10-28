#!/usr/bin/env python3
"""
Validates PRD v3.3 §3.5 AC-14:
- index.css < 1,000 lines
- No selector defined in two stylesheets
"""
import sys
import re
import glob
from collections import defaultdict

def parse_selectors(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        t = f.read()
    t = re.sub(r"/\*.*?\*/", "", t, flags=re.DOTALL)
    t = re.sub(r"@keyframes[^{]+{(?:[^{}]+|{[^{}]+})*}", "", t)
    t = re.sub(r"@media[^{]+{", "", t)
    matches = re.findall(r"([^{}]+)\{", t)
    selectors = set()
    for m in matches:
        m = m.strip()
        if m.startswith("@") or not m:
            continue
        for part in m.split(","):
            p = re.sub(r"\s+", " ", part.strip())
            if p:
                selectors.add(p)
    return selectors

def main():
    all_css_files = glob.glob("frontend/src/styles/**/*.css", recursive=True) + ["frontend/src/index.css"]
    selector_map = defaultdict(list)
    for cf in all_css_files:
        for s in parse_selectors(cf):
            selector_map[s].append(cf)

    dups = {s: files for s, files in selector_map.items() if len(files) > 1}
    
    with open("frontend/src/index.css") as f:
        line_count = len(f.readlines())

    print(f"index.css line count: {line_count} (must be < 1000)")
    print(f"Duplicate selectors across different stylesheets: {len(dups)}")

    if dups:
        for s, files in sorted(dups.items()):
            basenames = [f.split("/")[-1] for f in files]
            print(f"  CLASH: {s} -> {basenames}")
        sys.exit(1)

    if line_count >= 1000:
        print("FAIL: index.css has >= 1000 lines")
        sys.exit(1)

    print("PASS: AC-14 satisfied (index.css < 1000 lines, 0 selector collisions)")
    sys.exit(0)

if __name__ == "__main__":
    main()
