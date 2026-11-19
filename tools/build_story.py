#!/usr/bin/env python3
"""The verses of the story after the teaching in Capernaum (Mark 1:30 to 4:35, the verses the game stages), literal.

    python3 -I tools/build_story.py [path-to-biblia-conectada] [--check]

Reads fontes/blivre/porbr2018_vpl.zip of the biblia-conectada checkout (default: ../biblia-conectada), checked against
its fontes/SHA256SUMS before it is read, and writes src/data/mc-caminho.json.

Nothing is typed here. Each verse is copied whole from the BLIVRE file, with the one declared alteration the other
data files carry (ATTRIBUTION.md): the square brackets (words added by its translators) are removed, the words stay.
The file's own spacing is kept even where it looks like a slip of the source ("Jesus , movido", "Segue-me.Então"):
the clauses the game puts on screen (src/story-steps.ts) are cut so that none of them carries one.

--check regenerates in memory and fails if the committed file differs.
"""
import hashlib, json, re, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
BIBLIA = Path(args[0] if args else ROOT.parent / "biblia-conectada").resolve()
BLIVRE = BIBLIA / "fontes/blivre/porbr2018_vpl.zip"
OUT = ROOT / "src/data/mc-caminho.json"
BOOK = {"vpl": "MAR", "key": "Mark", "evangelho": "marcos"}
# chapter -> inclusive verse ranges: exactly the verses the steps quote (src/story-steps.ts; a test compares the two).
# A verse of these passages that no step stages is left out, so the game's Bible never marks as lived what was not
# staged: Mark 1:43-45, 2:6-10, 3:8, 3:10-12 and 3:15 are not here.
PASSAGES = {1: [(30, 42)], 2: [(1, 5), (11, 17)], 3: [(7, 7), (9, 9), (13, 14), (16, 19)], 4: [(1, 1), (35, 35)]}


def build():
    if not BLIVRE.exists():
        sys.exit(f"missing {BLIVRE}: pass the path of the biblia-conectada checkout")
    sums = {}
    for line in (BIBLIA / "fontes/SHA256SUMS").read_text(encoding="utf-8").splitlines():
        parts = line.split(maxsplit=1)
        if len(parts) == 2:
            sums[parts[1].strip()] = parts[0]
    digest = hashlib.sha256(BLIVRE.read_bytes()).hexdigest()
    if sums.get("blivre/porbr2018_vpl.zip") != digest:
        sys.exit(f"BLIVRE hash {digest} is not the one in fontes/SHA256SUMS")
    text = zipfile.ZipFile(BLIVRE).read("porbr2018_vpl.txt").decode("utf-8")
    source = {}
    for line in text.splitlines():
        m = re.match(r"^(\w+) (\d+):(\d+) (.*)$", line)
        if m and m[1] == BOOK["vpl"]:
            source[(int(m[2]), int(m[3]))] = m[4].rstrip("\r")
    gospels = json.loads((ROOT / "src/data/biblia-cronologica.json").read_text(encoding="utf-8"))["evangelhos"]
    name = next((g["nome"] for g in gospels if g["id"] == BOOK["evangelho"]), None)
    if not name:
        sys.exit("src/data/biblia-cronologica.json does not name the gospel")
    verses, ranges = {}, []
    for chapter, spans in PASSAGES.items():
        for a, b in spans:
            for n in range(a, b + 1):
                if not source.get((chapter, n)):
                    sys.exit(f"BLIVRE has no text for {BOOK['vpl']} {chapter}:{n}")
                verses[f"{BOOK['key']}.{chapter}.{n}"] = source[(chapter, n)].replace("[", "").replace("]", "")
            ranges.append(f"{name} {chapter}:{a}" + (f"–{b}" if b != a else ""))
    commit = subprocess.run(["git", "-C", str(BIBLIA), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return dict(
        id="mc-caminho",
        livro=name,
        passagens=ranges,
        versiculos=verses,
        fonte_texto="Bíblia Livre (BLIVRE), CC BY 4.0 BR",
        alteracao="colchetes da BLIVRE retirados; as palavras ficam",
        origem=dict(texto="biblia-conectada, fontes/blivre/porbr2018_vpl.zip", texto_sha256=digest, commit=commit or None),
    )


def main():
    data = json.dumps(build(), ensure_ascii=False, indent=1) + "\n"
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != data:
            sys.exit(f"{OUT.relative_to(ROOT)} differs from what the sources give: run tools/build_story.py and review the diff")
        print(f"{OUT.relative_to(ROOT)} matches the sources")
        return
    OUT.write_text(data, encoding="utf-8")
    d = json.loads(data)
    print(f"{OUT.relative_to(ROOT)}: {len(d['versiculos'])} versículos de {'; '.join(d['passagens'])}; BLIVRE {d['origem']['texto_sha256'][:12]}, "
          f"biblia-conectada {str(d['origem']['commit'])[:7]}")


if __name__ == "__main__":
    main()
