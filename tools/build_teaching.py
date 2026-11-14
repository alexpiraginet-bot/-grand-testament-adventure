#!/usr/bin/env python3
"""The verses of the step after the boat (Mark 1:21-22) and of the place the text goes to next (Mark 1:29), literal.

    python3 -I tools/build_teaching.py [path-to-biblia-conectada] [--check]

Reads fontes/blivre/porbr2018_vpl.zip of the biblia-conectada checkout (default: ../biblia-conectada), checked against
its fontes/SHA256SUMS before it is read, and writes src/data/mc-ensino.json.

Nothing is typed here. Each verse is copied whole from the BLIVRE file. One declared alteration, the same one
src/data/mc-pescadores.json carries (ATTRIBUTION.md): the BLIVRE's square brackets (words added by its translators)
are removed, the words stay, so no line on screen shows a bracket. The book's Portuguese name comes from
src/data/biblia-cronologica.json. The file's own spelling is kept even where it looks like a slip of the source
(Mark 1:22 reads "temautoridade" there): the game quotes only the clause before it (src/teaching-journey.ts).

--check regenerates in memory and fails if the committed file differs.
"""
import hashlib, json, re, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
BIBLIA = Path(args[0] if args else ROOT.parent / "biblia-conectada").resolve()
BLIVRE = BIBLIA / "fontes/blivre/porbr2018_vpl.zip"
OUT = ROOT / "src/data/mc-ensino.json"
BOOK = {"vpl": "MAR", "key": "Mark", "evangelho": "marcos"}
CHAPTER = 1
STEP = (21, 22)          # what this step of the game stages
BETWEEN = (23, 28)       # the text's next passage, in the same place: referenced, not staged, not copied
ONWARD = 29              # the verse that names where the text goes after it


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
    verses = {}
    for line in text.splitlines():
        m = re.match(r"^(\w+) (\d+):(\d+) (.*)$", line)
        if m and m[1] == BOOK["vpl"] and int(m[2]) == CHAPTER:
            verses[int(m[3])] = m[4].rstrip("\r")

    def verse(n):
        if not verses.get(n):
            sys.exit(f"BLIVRE has no text for {BOOK['vpl']} {CHAPTER}:{n}")
        return verses[n].replace("[", "").replace("]", "")

    gospels = json.loads((ROOT / "src/data/biblia-cronologica.json").read_text(encoding="utf-8"))["evangelhos"]
    name = next((g["nome"] for g in gospels if g["id"] == BOOK["evangelho"]), None)
    if not name:
        sys.exit("src/data/biblia-cronologica.json does not name the gospel")
    key = lambda n: f"{BOOK['key']}.{CHAPTER}.{n}"
    ref = lambda a, b=None: f"{name} {CHAPTER}:{a}" + (f"–{b}" if b and b != a else "")
    commit = subprocess.run(["git", "-C", str(BIBLIA), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return dict(
        id="mc-ensino",
        ref=f"{BOOK['key']}.{CHAPTER}.{STEP[0]}-{STEP[1]}",
        ref_pt=ref(*STEP),
        versiculos={key(n): verse(n) for n in range(STEP[0], STEP[1] + 1)},
        a_seguir=dict(de=key(BETWEEN[0]), ate=key(BETWEEN[1]), ref_pt=ref(*BETWEEN)),
        depois=dict(versiculo=key(ONWARD), ref_pt=ref(ONWARD), texto=verse(ONWARD)),
        fonte_texto="Bíblia Livre (BLIVRE), CC BY 4.0 BR",
        alteracao="colchetes da BLIVRE retirados; as palavras ficam",
        origem=dict(texto="biblia-conectada, fontes/blivre/porbr2018_vpl.zip", texto_sha256=digest, commit=commit or None),
    )


def main():
    data = json.dumps(build(), ensure_ascii=False, indent=1) + "\n"
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != data:
            sys.exit(f"{OUT.relative_to(ROOT)} differs from what the sources give: run tools/build_teaching.py and review the diff")
        print(f"{OUT.relative_to(ROOT)} matches the sources")
        return
    OUT.write_text(data, encoding="utf-8")
    d = json.loads(data)
    print(f"{OUT.relative_to(ROOT)}: {', '.join(d['versiculos'])} + {d['depois']['versiculo']}; BLIVRE {d['origem']['texto_sha256'][:12]}, "
          f"biblia-conectada {str(d['origem']['commit'])[:7]}")


if __name__ == "__main__":
    main()
