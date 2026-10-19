#!/usr/bin/env python3
"""Compact GLB/GLTF metadata scan — no binary dumps."""
from __future__ import annotations

import json
import struct
import sys
import zipfile
from pathlib import Path

ZIP_ROOT = Path(r"C:\Users\caiom\projects\zips_dragonball")
REPO = Path(__file__).resolve().parents[1]


def gltf_summary_bytes(data: bytes) -> str:
    if data.startswith(b"glTF"):
        if len(data) < 20:
            return "glb? (short)"
        length = struct.unpack_from("<I", data, 8)[0]
        chunk_len = struct.unpack_from("<I", data, 12)[0]
        chunk_type = struct.unpack_from("<I", data, 16)[0]
        if chunk_type != 0x4E4F534A:
            return "glb (no json chunk)"
        payload = data[20 : 20 + chunk_len]
        doc = json.loads(payload.decode("utf-8", errors="replace"))
    else:
        doc = json.loads(data.decode("utf-8", errors="replace"))
    meshes = len(doc.get("meshes", []))
    skins = doc.get("skins", [])
    bones = len(skins[0].get("joints", [])) if skins else 0
    anims = [a.get("name", "?") for a in doc.get("animations", [])]
    anim_part = f"{len(anims)} anims"
    if anims:
        anim_part += f" ({anims[0]}{'…' if len(anims) > 1 else ''})"
    return f"{meshes} mesh | {bones} bones | {anim_part}"


def scan_zip(zpath: Path, limit: int = 12) -> None:
    print(f"\n# {zpath.name}")
    with zipfile.ZipFile(zpath) as zf:
        names = [n for n in zf.namelist() if n.lower().endswith((".glb", ".gltf")) and not n.endswith("/")]
        print(f"  models: {len(names)}")
        for name in names[:limit]:
            try:
                raw = zf.read(name)
                label = Path(name).name
                print(f"  {label} | {gltf_summary_bytes(raw)}")
            except Exception as exc:  # noqa: BLE001
                print(f"  {Path(name).name} | error: {exc}")
        if len(names) > limit:
            print(f"  … +{len(names) - limit} more")


def main() -> int:
    patterns = [
        "Universal Base Characters",
        "Universal Animation Library 2",
        "Ultimate Animated Animals",
        "Ultimate Monsters",
        "Ultimate Stylized Nature",
        "Medular Character Outfits",
        "Medieval Village",
        "brackeys",
        "kenney_particle",
    ]
    zips = sorted(ZIP_ROOT.glob("*.zip"))
    if not zips:
        print("No zips in", ZIP_ROOT)
        return 1
    for pat in patterns:
        hit = next((z for z in zips if pat.lower() in z.name.lower()), None)
        if hit:
            scan_zip(hit)
    manifest = REPO / "public" / "assets" / "asset-manifest.json"
    if manifest.is_file():
        print("\n# repo manifest", manifest)
        data = json.loads(manifest.read_text(encoding="utf-8"))
        print(f"  entries: {len(data.get('assets', []))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
