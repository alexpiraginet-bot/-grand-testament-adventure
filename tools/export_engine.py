#!/usr/bin/env python3
"""The game's data for a native PC build (Unreal Engine 5, where DLSS runs): the same world and missions as the web build.

  python3 -I tools/export_engine.py   -> export/engine/  (generated, not in git)
     heightmap_1009.png     16-bit grayscale, Unreal Landscape convention: value = 32768 + height_cm * 128 / scale_z,
                            row 0 = north; lake surface = 32768 (world Z 0)
     watermask_1009.png     8-bit, 255 where the ground is under the lake surface
     landscape.json         resolution, square side, the scale to import with, axes, sources
     episodes.json          missions, lines (literal BLIVRE), names, counter proof, and every point in Unreal centimetres
     save-contract.json     the save (src/save.ts) and the cloud RPC (supabase/migrations), so both builds share progress

Heights come from public/world/cafarnaum-heights.json (tools/build_world.py, real elevation data). The 257-point grid
(12 m) is resampled (cubic, corner-aligned) to 1009 points (3.05 m): smoother, not more detailed. The source is SRTM, 30 m; detail
below that is the engine's (materials, displacement, scattered rocks), and is written down as such.
"""
import base64, json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "export/engine"
RES = 1009                      # an Unreal Landscape size (63 quads x 16 components + 1)
SCALE_Z = 100                   # Unreal Landscape Z scale: 1 unit = 100/128 cm, range +-256 m around Z 0


def heights(name):
    f = json.load(open(ROOT / "public/world" / name))
    a = np.frombuffer(base64.b64decode(f["b64"]), dtype="<i2").reshape(f["n"], f["n"]).astype(np.float64)
    return a / (100 if f["unit"] == "cm" else 10)


def to_unreal(x_east, z_south, h_m):
    """Game metres (x east, z south, y up) -> Unreal centimetres (X east, Y south, Z up), landscape centred on 0."""
    return [round(x_east * 100, 1), round(z_south * 100, 1), round(h_m * 100, 1)]


def main():
    meta = json.load(open(ROOT / "public/world/cafarnaum.json", encoding="utf-8"))
    ep = json.load(open(ROOT / "src/data/mc-pescadores.json", encoding="utf-8"))
    h = heights("cafarnaum-heights.json")
    # corner-aligned: grid point 0 and n-1 land on landscape vertex 0 and RES-1 (an image resize would shift the edges)
    g = np.linspace(0, h.shape[0] - 1, RES)
    gy, gx = np.meshgrid(g, g, indexing="ij")
    up = ndimage.map_coordinates(h, [gy, gx], order=3, mode="nearest")
    units = 32768 + np.round(up * 100 * 128 / SCALE_Z)
    assert units.min() >= 0 and units.max() <= 65535, "relief outside the 16-bit range at this Z scale"
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(units.astype(np.uint16)).save(OUT / f"heightmap_{RES}.png")
    # check what was written: read back, convert, compare with the source grid where they share a point
    back = (np.asarray(Image.open(OUT / f"heightmap_{RES}.png"), dtype=np.float64) - 32768) * SCALE_Z / 128 / 100
    assert np.abs(back - up).max() <= SCALE_Z / 128 / 100 / 2 + 1e-9, "heightmap does not read back"
    for (i, j) in [(0, 0), (RES - 1, RES - 1), (0, RES - 1), ((RES - 1) // 2, (RES - 1) // 2)]:
        si, sj = round(i * (h.shape[0] - 1) / (RES - 1)), round(j * (h.shape[0] - 1) / (RES - 1))
        assert abs(back[i, j] - h[si, sj]) < 0.01, (i, j, back[i, j], h[si, sj])
    Image.fromarray(((up < 0) * 255).astype(np.uint8)).save(OUT / f"watermask_{RES}.png")

    step_cm = meta["size"] * 100 / (RES - 1)
    land = dict(
        resolution=RES, side_m=meta["size"], scale_xy_cm=round(step_cm, 4), scale_z=SCALE_Z,
        location_cm=[round(-meta["size"] * 50, 1), round(-meta["size"] * 50, 1), 0.0],
        axes="Unreal: X = east, Y = south (row 0 of the image is north), Z = up; the lake surface is Z = 0",
        lake_level_m=meta["lake_level_m"], centre=meta["center"],
        height_range_m=[round(float(up.min()), 2), round(float(up.max()), 2)],
        detail="cubic, corner-aligned, from a 12 m grid; source SRTM 30 m. Finer detail belongs to the engine and is not data",
        sources=meta["sources"], level_design=meta["level_design"],
    )
    json.dump(land, open(OUT / "landscape.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    def h_at(x, z):
        n = h.shape[0]; s = meta["size"]; st = s / (n - 1)
        gx = min(n - 1.0001, max(0, (x + s / 2) / st)); gz = min(n - 1.0001, max(0, (z + s / 2) / st))
        i, j = int(gx), int(gz); fx, fz = gx - i, gz - j
        return float((h[j, i] * (1 - fx) + h[j, i + 1] * fx) * (1 - fz) + (h[j + 1, i] * (1 - fx) + h[j + 1, i + 1] * fx) * fz)
    pts = {k: dict(game_m=v, unreal_cm=to_unreal(v[0], v[1], max(h_at(*v), 0.0))) for k, v in meta["points"].items()}
    places = [dict(p, unreal_cm=to_unreal(p["x"], p["z"], max(h_at(p["x"], p["z"]), 0.0))) for p in meta["places"]]
    json.dump(dict(episode=ep, points=pts, places=places, shoreline_game_m=meta["shoreline"]),
              open(OUT / "episodes.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    nuvem = json.load(open(ROOT / "src/data/nuvem.json", encoding="utf-8"))
    contract = dict(
        save_version=1, storage_key="gta:save",
        fields=dict(v="1", id="string", createdAt="ms since epoch", updatedAt="ms since epoch", playSeconds="number >= 0",
                    episodes="{ [episodeId]: { missionsDone: int, completions: int, firstCompletedAt: ms|null, lastCompletedAt: ms|null } }",
                    current="null | { episode, mission: int, pos: { x, z } (game metres), heading: radians, 0 = north, clockwise }"),
        merge="src/save.ts mergeSaves: per episode the maximum of missionsDone and completions; the place from the newer copy",
        cloud=dict(url=nuvem["url"], key_kind="publishable", rpc_get="POST /rest/v1/rpc/gta_save_get {p_code}",
                   rpc_put="POST /rest/v1/rpc/gta_save_put {p_code, p_data}",
                   code="32 characters of Crockford base32 (src/cloud.ts); the server keeps only sha256(code)",
                   enabled=nuvem["enabled"]),
    )
    json.dump(contract, open(OUT / "save-contract.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{OUT}: heightmap {RES}x{RES}, {step_cm:.2f} cm per point, heights {up.min():.2f}..{up.max():.2f} m, "
          f"16-bit {int(units.min())}..{int(units.max())}; {len(pts)} points, {len(places)} places")


if __name__ == "__main__":
    main()
