#!/usr/bin/env python3
"""The game's Bible: biblia-conectada's chronological reading itinerary, with the literal BLIVRE text of each passage.

    python3 -I tools/build_bible.py [path-to-biblia-conectada] [--check]

Reads from the biblia-conectada checkout (default: ../biblia-conectada, next to this repository):
  site/src/lib/chronological-reading.ts   the itinerary: its moments in reading order, with their passages per gospel
  fontes/blivre/porbr2018_vpl.zip         the BLIVRE text, checked against fontes/SHA256SUMS before it is read
and writes src/data/biblia-cronologica.json.

Nothing is typed here. Titles, phases, places and references are the itinerary's own (an editorial reading order of
biblia-conectada, which its source describes as "not a harmonized historical chronology"). Every verse is copied whole
and verbatim from the BLIVRE file, brackets and spacing included, as biblia-conectada's own site shows it.
The text of a moment is its default gospel's passage; the other gospels' passages are listed by reference only.

--check regenerates in memory and fails if the committed file differs (run it after updating biblia-conectada).
Needs Node 22.18 or newer on the PATH: the itinerary is a TypeScript module and is read by importing it.
"""
import hashlib, json, re, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
BIBLIA = Path(args[0] if args else ROOT.parent / "biblia-conectada").resolve()
ITINERARY = BIBLIA / "site/src/lib/chronological-reading.ts"
BLIVRE = BIBLIA / "fontes/blivre/porbr2018_vpl.zip"
OUT = ROOT / "src/data/biblia-cronologica.json"
VPL = {"mateus": "MAT", "marcos": "MAR", "lucas": "LUK", "joao": "JOH"}       # the itinerary's gospel ids -> VPL books


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    for p in (ITINERARY, BLIVRE):
        if not p.exists():
            sys.exit(f"missing {p}: pass the path of the biblia-conectada checkout")
    # the BLIVRE file must be the one biblia-conectada pinned
    sums = {}
    for line in (BIBLIA / "fontes/SHA256SUMS").read_text(encoding="utf-8").splitlines():
        parts = line.split(maxsplit=1)                     # "<sha256>  <path>"; a path may hold spaces
        if len(parts) == 2:
            sums[parts[1].strip()] = parts[0]
    digest = sha256(BLIVRE)
    if sums.get("blivre/porbr2018_vpl.zip") != digest:
        sys.exit(f"BLIVRE hash {digest} is not the one in fontes/SHA256SUMS")
    text = zipfile.ZipFile(BLIVRE).read("porbr2018_vpl.txt").decode("utf-8")
    verses = {}
    for line in text.splitlines():
        m = re.match(r"^(\w+) (\d+):(\d+) (.*)$", line)
        if m:
            verses[(m[1], int(m[2]), int(m[3]))] = m[4].rstrip("\r")

    # the itinerary, by importing the module (Node strips the types) and printing what it exports
    js = ("import(process.argv[1]).then((m) => console.log(JSON.stringify({ moments: m.CHRONOLOGICAL_MOMENTS, gospels: m.GOSPELS,"
          " refs: m.CHRONOLOGICAL_MOMENTS.map((x) => x.passages.map(m.passageReference)) })))")
    run = subprocess.run(["node", "--input-type=module", "-e", js, ITINERARY.as_uri()], capture_output=True, text=True)
    if run.returncode:
        sys.exit(f"could not read the itinerary with node:\n{run.stderr}")
    it = json.loads(run.stdout)
    label = {g["id"]: g["label"] for g in it["gospels"]}

    moments = []
    for mo, refs in zip(it["moments"], it["refs"]):
        passages = [dict(evangelho=p["gospel"], capitulo=p["chapter"], de=p["from"], ate=p["to"], relacao=p["relation"], ref=r)
                    for p, r in zip(mo["passages"], refs)]
        main = next((p for p in passages if p["evangelho"] == mo["defaultGospel"]), None)
        if main is None:
            sys.exit(f"{mo['id']}: no passage in its default gospel {mo['defaultGospel']}")
        out = []
        for n in range(main["de"], main["ate"] + 1):
            key = (VPL[main["evangelho"]], main["capitulo"], n)
            if not verses.get(key):
                sys.exit(f"{mo['id']}: BLIVRE has no text for {main['ref']} verse {n}")
            out.append(dict(n=n, texto=verses[key]))
        moments.append(dict(id=mo["id"], titulo=mo["title"], fase=mo["phase"], lugar=mo["place"],
                            evangelho=label[main["evangelho"]], ref=main["ref"], versiculos=out, passagens=passages))

    commit = subprocess.run(["git", "-C", str(BIBLIA), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return dict(
        origem=dict(
            roteiro="biblia-conectada, site/src/lib/chronological-reading.ts (roteiro editorial de leitura do Bíblia Conectada)",
            roteiro_sha256=sha256(ITINERARY),
            texto="biblia-conectada, fontes/blivre/porbr2018_vpl.zip",
            texto_sha256=digest,
            commit=commit or None,
        ),
        fonte_texto="Bíblia Livre (BLIVRE), CC BY 4.0 BR",
        evangelhos=[dict(id=g["id"], nome=g["label"]) for g in it["gospels"]],
        momentos=moments,
    )


def main():
    data = json.dumps(build(), ensure_ascii=False, indent=1) + "\n"
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != data:
            sys.exit(f"{OUT.relative_to(ROOT)} differs from what the sources give: run tools/build_bible.py and review the diff")
        print(f"{OUT.relative_to(ROOT)} matches the sources")
        return
    OUT.write_text(data, encoding="utf-8")
    d = json.loads(data)
    print(f"{OUT.relative_to(ROOT)}: {len(d['momentos'])} momentos, {sum(len(m['versiculos']) for m in d['momentos'])} versículos; "
          f"BLIVRE {d['origem']['texto_sha256'][:12]}, roteiro {d['origem']['roteiro_sha256'][:12]}, biblia-conectada {str(d['origem']['commit'])[:7]}")


if __name__ == "__main__":
    main()
