#!/usr/bin/env python3
"""World data of the first vertical slice: the shore of the Sea of Galilee at Capernaum (Mark 1:16-20).

Everything the game puts on the ground or on the screen as a fact comes out of this script, from open data:

  relief   AWS Terrain Tiles, terrarium z14 (SRTM / GMTED2010 via USGS, ETOPO1 via NOAA; Mapzen), the same source the
           reels' radar uses (biblia-conectada, estudos/biblia-natal/tools/terrain.py). The SHA-256 of every tile used is
           written to data/terrain-tiles.sha256; a second run checks the cached tiles against it.
  places   OpenBible.info Bible Geocoding Data (CC BY 4.0), names as the BLIVRE writes them, read from
           biblia-conectada/estudos/biblia-grand-testament-adventure/data/passagens.json (made and checked there by
           tools/check.py).
  text     Bíblia Livre (BLIVRE, CC BY 4.0 BR): the verses of Mark 1:16-21 are copied whole into the episode file, so the
           game's tests can check that every line shown is a literal fragment of its verse.

  python3 -I tools/build_world.py [path to a biblia-conectada checkout on branch claude/grand-testament-adventure]
  -> public/world/cafarnaum-heights.json  heights, int16 centimetres above the lake surface, N x N, row 0 = north
     public/world/far-heights.json        the horizon, int16 decimetres (both: little-endian int16 in base64, plain
                                          JSON so any static host serves them)
     public/world/cafarnaum.json  grid, lake level, shoreline, mission points, places, sources
     public/world/radar.png       the radar's map (hillshade + water), same square as the grid
     src/data/mc-pescadores.json  episode 1: missions, lines (literal BLIVRE), counter proof, verses

Level design that is ours and not the text's (written to the json as such): where on the shore Simon and Andrew stand,
how far "um pouco mais adiante" (Mark 1:19) is, the start point inland, the two hired men in the boat (Mark 1:20 says
"os empregados", no number), and the sea bed under the water (the elevation data only has the lake surface).
"""
import hashlib, json, math, re, subprocess, sys, zipfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
BIBLIA = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT.parent / "gta-src").resolve()
GTA = BIBLIA / "estudos/biblia-grand-testament-adventure"
CACHE = ROOT / "tools/.cache/tiles"
SUMS = ROOT / "data/terrain-tiles.sha256"
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
Z = 14
SIZE = 3072.0          # metres, side of the square world
N = 257                # grid points per side (12 m spacing)
EP = "mc-pescadores"
FAR_SIZE = 30000.0     # metres, the horizon square (z11 tiles, about 64 m per pixel here)
FAR_N = 161

# level design (metres): ours, see the docstring
ALONG_SIMAO = 260      # along the shoreline, west of the beach point
ALONG_BARCO = 520      # "um pouco mais adiante" (Mark 1:19)
INLAND_START = 300     # the start point, inland from the beach point
BOAT_OFFSHORE = 26
EMPREGADOS = 2         # Mark 1:20 gives no number


def heights_json(name, a, unit):
    import base64
    a = np.ascontiguousarray(a, dtype="<i2")
    out = dict(format="int16 little-endian, base64, row-major, row 0 = north", unit=unit, n=int(a.shape[0]),
               sha256=hashlib.sha256(a.tobytes()).hexdigest(), b64=base64.b64encode(a.tobytes()).decode("ascii"))
    (ROOT / "public/world").mkdir(parents=True, exist_ok=True)
    json.dump(out, open(ROOT / "public/world" / name, "w"))


def merc_px(lon, lat, z=Z):
    n = 256 * 2 ** z
    s = math.sin(math.radians(lat))
    return (lon + 180) / 360 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n


def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()


def tiles(tx0, tx1, ty0, ty1, z=Z):
    known = {}
    if SUMS.exists():
        for line in SUMS.read_text().splitlines():
            h, name = line.split(); known[name] = h
    CACHE.mkdir(parents=True, exist_ok=True)
    out = {}
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            name = f"{z}/{tx}_{ty}.png"; p = CACHE / name.replace("/", "_")
            if not p.exists() or p.stat().st_size < 100:
                subprocess.run(["curl", "-sS", "--fail", "--max-time", "60", "--retry", "3", "-o", str(p), URL.format(z=z, x=tx, y=ty)], check=True)
            h = sha(p)
            if name in known and known[name] != h: sys.exit(f"FAIL tile {name}: sha256 {h} != recorded {known[name]}")
            out[name] = h
    return out


def write_sums(*parts):
    allp = {}
    for d in parts: allp.update(d)
    SUMS.parent.mkdir(parents=True, exist_ok=True)
    SUMS.write_text("".join(f"{h}  {n}\n" for n, h in sorted(allp.items())))


def mosaic(z, tx0, tx1, ty0, ty1):
    M = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.float32)
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            im = cv2.imread(str(CACHE / f"{z}_{tx}_{ty}.png"), cv2.IMREAD_UNCHANGED)
            assert im is not None and im.shape[:2] == (256, 256), (z, tx, ty)
            b, g, r = [im[..., i].astype(np.float32) for i in range(3)]
            M[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = r * 256 + g + b / 256 - 32768
    return M


def main():
    pj = json.load(open(GTA / "data/passagens.json", encoding="utf-8"))
    lug = {g["id"]: g for g in pj["lugares"]}
    cap = lug["Capernaum"]; lon0, lat0 = cap["lon"], cap["lat"]
    mpp = 40075016.686 * math.cos(math.radians(lat0)) / (256 * 2 ** Z)     # metres per z14 pixel here
    cx, cy = merc_px(lon0, lat0)
    half = SIZE / 2 / mpp + 4
    tx0, tx1 = int((cx - half) // 256), int((cx + half) // 256)
    ty0, ty1 = int((cy - half) // 256), int((cy + half) // 256)
    sums = tiles(tx0, tx1, ty0, ty1)
    M = mosaic(Z, tx0, tx1, ty0, ty1)

    def sample(east, north, order=1):
        X = cx + east / mpp - tx0 * 256 - 0.5; Y = cy - north / mpp - ty0 * 256 - 0.5
        return ndimage.map_coordinates(M, [Y, X], order=order, mode="nearest")

    step = SIZE / (N - 1)
    ax = (np.arange(N) - (N - 1) / 2) * step
    east, north = np.meshgrid(ax, -ax)                                      # row 0 = north
    h = sample(east, north)

    # the lake: the large level area at the bottom of the rift (the DEM gives the Sea of Galilee one surface value)
    gy, gx = np.gradient(h, step)
    flat = ndimage.binary_opening(np.hypot(gx, gy) < 0.004, iterations=2) & (h < -150)
    lab, k = ndimage.label(flat); sizes = np.bincount(lab.ravel()); sizes[0] = 0
    lake_id = int(sizes.argmax()); assert sizes[lake_id] > N * N * 0.05, "no lake found"
    level = float(np.median(h[lab == lake_id]))
    water = ndimage.binary_fill_holes(ndimage.binary_closing(lab == lake_id, iterations=2))
    water |= (h <= level + 0.05) & ndimage.binary_dilation(water, iterations=3)
    water = ndimage.binary_fill_holes(water)
    land_h = h - level

    # sea bed (ours: the DEM has only the surface): 0.25 m at the waterline, sloping 1:14, to 9 m
    dist = ndimage.distance_transform_edt(water) * step
    depth = np.minimum(9.0, 0.25 + dist / 14.0)
    rel = np.where(water, -depth, np.maximum(land_h, 0.15))
    # the mask is a staircase of 12 m cells: smooth a 60 m band around the waterline so the shore the player sees (and
    # the shoreline below, taken where the smoothed height crosses 0) follows the lake, not the grid
    edge = ndimage.distance_transform_edt(~(ndimage.binary_dilation(water) ^ ndimage.binary_erosion(water))) * step
    blend = np.clip(1 - (edge - 30) / 30, 0, 1)
    rel = rel * (1 - blend) + ndimage.gaussian_filter(rel, 1.6) * blend
    water = rel < 0
    cm = np.round(rel * 100).astype(np.int16)
    (ROOT / "public/world").mkdir(parents=True, exist_ok=True)
    heights_json("cafarnaum-heights.json", cm, "cm")

    # shoreline, west to east, in world metres (x east, z south): the 0 m line of the smoothed heights (marching squares)
    from skimage import measure
    cs = measure.find_contours(rel, 0.0)
    c = max(cs, key=len)                                                       # (row, col), sub-cell
    pts = np.stack([c[:, 1] * step - SIZE / 2, c[:, 0] * step - SIZE / 2], 1)  # x east, z south
    inside = (np.abs(pts[:, 0]) < SIZE / 2 - 3 * step) & (np.abs(pts[:, 1]) < SIZE / 2 - 3 * step)
    pts = pts[inside]
    keep = [0]
    for i in range(1, len(pts)):                                               # resample to about one point per 6 m
        if np.hypot(*(pts[i] - pts[keep[-1]])) >= step / 2: keep.append(i)
    pts = pts[keep]
    if pts[0, 0] > pts[-1, 0]: pts = pts[::-1]
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]

    def at(s):
        s = float(np.clip(s, 0, seg[-1])); i = int(np.searchsorted(seg, s)) - 1; i = max(0, min(i, len(pts) - 2))
        t = (s - seg[i]) / max(1e-9, seg[i + 1] - seg[i]); p = pts[i] * (1 - t) + pts[i + 1] * t
        d = pts[min(i + 3, len(pts) - 1)] - pts[max(i - 3, 0)]; d /= np.linalg.norm(d)
        return p, d

    def is_water(x, z):
        j = int(round((x + SIZE / 2) / step)); i = int(round((z + SIZE / 2) / step))
        return bool(water[min(max(i, 0), N - 1), min(max(j, 0), N - 1)])

    def landward(p, d):
        nrm = np.array([-d[1], d[0]])
        return nrm if not is_water(*(p + nrm * 30)) else -nrm

    near = int(np.argmin(np.hypot(pts[:, 0], pts[:, 1]))); s_beach = seg[near]
    beach, d0 = at(s_beach); up = landward(beach, d0)
    simao, d1 = at(s_beach - ALONG_SIMAO)                                      # pts run west -> east: minus = west
    barco, d2 = at(s_beach - ALONG_BARCO)
    start = beach + up * INLAND_START
    assert not is_water(*start), "start in the water"
    boat = barco - landward(barco, d2) * BOAT_OFFSHORE
    assert is_water(*boat), "boat on land"

    def rumo(a, b):                                                            # heading from a to b, degrees clockwise from north
        return round((math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1]))) + 360) % 360)

    places = []
    for g in pj["lugares"]:
        x, y = merc_px(g["lon"], g["lat"])
        e, nn = (x - cx) * mpp, -(y - cy) * mpp
        if abs(e) < SIZE / 2 and abs(nn) < SIZE / 2:
            places.append(dict(id=g["id"], nome=g["nome"], tipo=g["tipo"], x=round(e, 1), z=round(-nn, 1)))

    # radar map: hillshade + water, the paper and water colours of the reels' radar (hud.py)
    R = 512
    k = R / N
    hi = np.asarray(Image.fromarray(rel.astype(np.float32), "F").resize((R, R), Image.BICUBIC))
    wm = hi < 0                                                                # the waterline of the smoothed heights, not of the cells
    hs = ndimage.gaussian_filter(np.where(wm, 0, hi), 1.2)
    g1, g0 = np.gradient(hs, SIZE / R); zx = 2.2
    nrm = np.sqrt((g0 * zx) ** 2 + (g1 * zx) ** 2 + 1)
    shade = np.clip((((g0 * zx) * 0.5 + (g1 * zx) * 0.5 + 0.707) / nrm - 0.25) / 0.75, 0, 1)
    paper = np.array([226, 205, 164], np.float32)
    e = np.clip(hs / max(1.0, np.percentile(hs, 98)), 0, 1)[..., None]
    img = paper * (0.92 + 0.10 * e) * (0.62 + 0.44 * shade[..., None])
    d_ = ndimage.distance_transform_edt(wm)
    img[wm] = np.array([112, 140, 146], np.float32)
    rip = wm & (d_ > 4) & (d_ < 60) & ((d_ % 12) < 1.4)
    img[rip] = img[rip] * 0.72 + np.array([70, 96, 104], np.float32) * 0.28
    shore = ndimage.binary_dilation(wm, iterations=2) & ~wm
    img[shore] = np.array([58, 40, 24], np.float32)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(ROOT / "public/world/radar.png", optimize=True)

    # the far land around the lake (the horizon), z11 tiles: FAR_SIZE square, FAR_N grid, decimetres above the lake.
    # Inside the near square it is pushed under the near ground (the near grid is what the player walks on).
    zf = 11; mppf = 40075016.686 * math.cos(math.radians(lat0)) / (256 * 2 ** zf)
    fcx, fcy = merc_px(lon0, lat0, zf); fh = FAR_SIZE / 2 / mppf + 4
    fx0, fx1, fy0, fy1 = int((fcx - fh) // 256), int((fcx + fh) // 256), int((fcy - fh) // 256), int((fcy + fh) // 256)
    sums_far = tiles(fx0, fx1, fy0, fy1, zf)
    MF = mosaic(zf, fx0, fx1, fy0, fy1)
    fax = (np.arange(FAR_N) - (FAR_N - 1) / 2) * (FAR_SIZE / (FAR_N - 1))
    fe, fn = np.meshgrid(fax, -fax)
    hf = ndimage.map_coordinates(MF, [fcy - fn / mppf - fy0 * 256 - 0.5, fcx + fe / mppf - fx0 * 256 - 0.5], order=1, mode="nearest") - level
    hf = np.where(hf < 1.0, -4.0, hf)                                             # the lake (and the shore band) under the water
    under = (np.abs(fe) < SIZE / 2 - 60) & (np.abs(fn) < SIZE / 2 - 60)
    hf[under] = -25.0
    heights_json("far-heights.json", np.round(hf * 10).astype(np.int16), "dm")
    write_sums(sums, sums_far)

    r2 = lambda p: [round(float(p[0]), 1), round(float(p[1]), 1)]
    world = dict(
        id="cafarnaum", size=SIZE, n=N, step=step, units="int16 cm above the lake surface, row 0 = north, x east, z south",
        center=dict(lugar="Capernaum", nome=cap["nome"], lon=lon0, lat=lat0),
        lake_level_m=round(level, 2),
        relief_range_m=[round(float(rel.min()), 2), round(float(rel.max()), 2)],
        water_cells=int(water.sum()),
        shoreline=[r2(p) for p in pts],
        points=dict(start=r2(start), beach=r2(beach), simao=r2(simao), barco=r2(boat), barco_margem=r2(barco)),
        rumos=dict(start_beach=rumo(start, beach), beach_simao=rumo(beach, simao), simao_barco=rumo(simao, boat)),
        far=dict(size=FAR_SIZE, n=FAR_N, units="int16 dm above the lake surface, row 0 = north", tiles_z=zf, tiles=len(sums_far)),
        level_design=dict(along_simao_m=ALONG_SIMAO, along_barco_m=ALONG_BARCO, inland_start_m=INLAND_START,
                          boat_offshore_m=BOAT_OFFSHORE, empregados=EMPREGADOS,
                          sea_bed="ours: 0.25 m at the waterline, slope 1:14, at most 9 m (the DEM has only the surface)"),
        places=places,
        sources=dict(relief="AWS Terrain Tiles, terrarium z14: SRTM/GMTED2010 (USGS), ETOPO1 (NOAA), Mapzen",
                     tiles=len(sums) + len(sums_far), tiles_sha256="data/terrain-tiles.sha256",
                     places=pj["fonte_lugares"], text=pj["fonte_texto"]),
    )
    json.dump(world, open(ROOT / "public/world/cafarnaum.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # episode 1: lines from the checked data, and the verses whole (for the literal-fragment test)
    VPL = {"Matt": "MAT", "Mark": "MAR", "Luke": "LUK", "John": "JOH"}
    t = zipfile.ZipFile(BIBLIA / "fontes/blivre/porbr2018_vpl.zip").read("porbr2018_vpl.txt").decode("utf-8")
    plain = lambda s: re.sub(r"\s+", " ", s.replace("[", "").replace("]", "")).replace(" ,", ",").replace(" .", ".").strip()
    raw = {}
    for line in t.splitlines():
        m = re.match(r"^(\w+) (\d+):(\d+) (.*)$", line)
        if m and m[1] == "MAR" and m[2] == "1" and 16 <= int(m[3]) <= 21: raw[f"Mark.1.{int(m[3])}"] = plain(m[4])
    ep = pj["episodios"][EP]; p = next(x for x in pj["passagens"] if x["id"] == EP)
    src_ep = (GTA / "episodios.py").read_text(encoding="utf-8")
    prova = re.search(r'"mc-pescadores".*?prova=\[(.*?)\]\)', src_ep, re.S)[1]
    prova = [dict(ref=a, nome=b) for a, b in re.findall(r'\("([\w.]+)", "([^"]+)"\)', prova)]
    out = dict(
        id=EP, titulo=p["titulo"], ref=p["ref"], ref_pt=p["ref_pt"], lugar=p["lugar"], lugar_ref=p["lugar_ref"],
        contador=dict(rotulo=ep["contador"]["rotulo"], prova=prova),
        # who the game shows, with the verse that names each one (ids are ours; the names are the BLIVRE's)
        personagens=[dict(id=i, ref=q["ref"], nome=q["nome"]) for i, q in zip(["simao", "andre", "tiago", "joao"], prova)]
                    + [dict(id="zebedeu", ref="Mark.1.20", nome="Zebedeu")],
        missoes=[dict(objetivo=m["objetivo"], acao=m["acao"], fala=m["fala"], conta=m["conta"]) for m in ep["missoes"]],
        versiculos=raw,
        fonte_texto=pj["fonte_texto"],
        origem="biblia-conectada, estudos/biblia-grand-testament-adventure/data/passagens.json (tools/check.py)",
    )
    (ROOT / "src/data").mkdir(parents=True, exist_ok=True)
    notice = [l[2:].strip() for l in (BIBLIA / "ATTRIBUTION.md").read_text(encoding="utf-8").splitlines() if l.startswith("> Todas as Escrituras")]
    assert len(notice) == 1, notice
    json.dump(dict(blivre=notice[0], origem="biblia-conectada/ATTRIBUTION.md"), open(ROOT / "src/data/attribution.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(out, open(ROOT / f"src/data/{EP}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"tiles {len(sums)}  lake {level:.2f} m  relief {rel.min():.1f}..{rel.max():.1f} m  water {water.mean() * 100:.0f}%  "
          f"shore {seg[-1]:.0f} m  points {world['points']}  rumos {world['rumos']}  places {[q['nome'] for q in places]}")


if __name__ == "__main__":
    main()
