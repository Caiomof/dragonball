#!/usr/bin/env python3
"""Extract selected assets from zips into public/assets (no full zip unpack)."""
from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

ZIP_ROOT = Path(r"C:\Users\caiom\projects\zips_dragonball")
REPO = Path(__file__).resolve().parents[1]
ASSETS = REPO / "public" / "assets"

PACKAGES = {
    "animals": ZIP_ROOT / "Ultimate Animated Animals - July 2021-20261015T223946Z-1-001.zip",
    "ual2": ZIP_ROOT / "Universal Animation Library 2[Standard].zip",
    "base": ZIP_ROOT / "Universal Base Characters[Standard].zip",
    "outfits": ZIP_ROOT / "Modular Character Outfits - Fantasy[Standard].zip",
    "monsters": ZIP_ROOT / "Ultimate Monsters-20261015T224141Z-1-001.zip",
    "nature": ZIP_ROOT / "Ultimate Stylized Nature - May 2022-20261015T224327Z-1-001.zip",
    "village": ZIP_ROOT / "Medieval Village MegaKit[Standard].zip",
    "vfx_brackeys": ZIP_ROOT / "brackeys_vfx_bundle.zip",
    "vfx_kenney": ZIP_ROOT / "kenney_particle-pack.zip",
}


def zip_find(zf: zipfile.ZipFile, suffix: str) -> str:
    needle = suffix.replace("\\", "/").lstrip("/")
    for name in zf.namelist():
        norm = name.replace("\\", "/")
        if norm.endswith(needle) and not norm.endswith("/"):
            return name
    raise FileNotFoundError(suffix)


def extract_member(zf: zipfile.ZipFile, member: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zf.open(member) as src, dest.open("wb") as out:
        shutil.copyfileobj(src, out)


def extract_gltf_bundle(zf: zipfile.ZipFile, gltf_member: str, dest_dir: Path) -> list[str]:
    """Copy .gltf plus buffer/texture URIs referenced in the same zip folder."""
    norm_member = gltf_member.replace("\\", "/")
    folder = norm_member.rsplit("/", 1)[0] + "/"
    written: list[str] = []
    dest_dir.mkdir(parents=True, exist_ok=True)
    gltf_dest = dest_dir / Path(norm_member).name
    extract_member(zf, gltf_member, gltf_dest)
    written.append(gltf_dest.name)
    with zf.open(gltf_member) as src:
        data = json.loads(src.read().decode("utf-8"))
    uris: set[str] = set()
    for buf in data.get("buffers", []):
        uri = buf.get("uri")
        if uri and not uri.startswith("data:"):
            uris.add(uri.split("/")[-1])
    for img in data.get("images", []):
        uri = img.get("uri")
        if uri and not uri.startswith("data:"):
            uris.add(uri.split("/")[-1])
    for leaf in sorted(uris):
        member = folder + leaf
        if member not in zf.namelist():
            alt = folder + Path(leaf).name
            if alt in zf.namelist():
                member = alt
            else:
                continue
        out = dest_dir / Path(leaf).name
        extract_member(zf, member, out)
        written.append(out.name)
    return written


def extract_zip_folder(zf: zipfile.ZipFile, folder_suffix: str, dest_dir: Path) -> int:
    """Copy every file under a zip folder (e.g. .../glTF/) into dest_dir."""
    needle = folder_suffix.replace("\\", "/").strip("/")
    written = 0
    dest_dir.mkdir(parents=True, exist_ok=True)
    for name in zf.namelist():
        n = name.replace("\\", "/")
        if f"/{needle}/" not in f"/{n}":
            continue
        if n.endswith("/"):
            continue
        leaf = n.split(f"{needle}/", 1)[-1]
        if "/" in leaf:
            continue
        extract_member(zf, name, dest_dir / leaf)
        written += 1
    return written


def import_animals() -> list[dict]:
    log: list[dict] = []
    mapping = {
        "wolf": "Wolf.gltf",
        "deer": "Deer.gltf",
        "hare": "Fox.gltf",
        "cow": "Cow.gltf",
        "bull": "Bull.gltf",
        "horse": "Horse.gltf",
    }
    with zipfile.ZipFile(PACKAGES["animals"]) as zf:
        for kind, file_name in mapping.items():
            member = zip_find(zf, f"glTF/{file_name}")
            dest_dir = ASSETS / "creatures" / "animals" / kind
            extract_gltf_bundle(zf, member, dest_dir)
            log.append({"id": f"animal.{kind}", "path": str((dest_dir / file_name).relative_to(REPO)), "package": "Ultimate Animated Animals", "role": kind})
    return log


def import_ual2() -> list[dict]:
    log: list[dict] = []
    with zipfile.ZipFile(PACKAGES["ual2"]) as zf:
        member = zip_find(zf, "UAL2_Standard.glb")
        dest = ASSETS / "animations" / "humanoids" / "UAL2_Standard.glb"
        extract_member(zf, member, dest)
        log.append({"id": "anim.ual2", "path": str(dest.relative_to(REPO)), "package": "UAL2", "role": "humanoid clips"})
    return log


def import_bodies() -> list[dict]:
    log: list[dict] = []
    pairs = [
        ("superhero_male", "Superhero_Male_FullBody.gltf"),
        ("superhero_female", "Superhero_Female_FullBody.gltf"),
    ]
    hair_files = [
        "Hair_Long.gltf",
        "Hair_Buns.gltf",
        "Hair_Buzzed.gltf",
        "Hair_BuzzedFemale.gltf",
        "Hair_SimpleParted.gltf",
        "Hair_Beard.gltf",
    ]
    with zipfile.ZipFile(PACKAGES["base"]) as zf:
        for body_id, gltf_name in pairs:
            member = zip_find(zf, gltf_name)
            folder = ASSETS / "characters" / "bodies" / body_id
            extract_gltf_bundle(zf, member, folder)
            log.append({"id": f"body.{body_id}", "path": str((folder / gltf_name).relative_to(REPO)), "package": "Universal Base Characters", "role": body_id})
        for hair in hair_files:
            member = zip_find(zf, hair)
            dest_dir = ASSETS / "characters" / "hair"
            extract_gltf_bundle(zf, member, dest_dir)
            log.append({"id": f"hair.{hair}", "path": str((dest_dir / hair).relative_to(REPO)), "package": "Universal Base Characters", "role": "hair"})
    hero_dir = REPO / "public" / "models" / "hero"
    hero_dir.mkdir(parents=True, exist_ok=True)
    src = ASSETS / "characters" / "bodies" / "superhero_male" / "Superhero_Male_FullBody.gltf"
    shutil.copy2(src, hero_dir / "Superhero_Male_FullBody.gltf")
    bin_src = ASSETS / "characters" / "bodies" / "superhero_male" / "Superhero_Male_FullBody.bin"
    if bin_src.is_file():
        shutil.copy2(bin_src, hero_dir / "Superhero_Male_FullBody.bin")
    return log


def import_outfits() -> list[dict]:
    log: list[dict] = []
    picks = [
        "Male_Ranger.gltf",
        "Male_Peasant.gltf",
        "Female_Ranger.gltf",
        "Female_Peasant.gltf",
    ]
    with zipfile.ZipFile(PACKAGES["outfits"]) as zf:
        for pick in picks:
            member = zip_find(zf, pick)
            dest_dir = ASSETS / "characters" / "outfits"
            extract_gltf_bundle(zf, member, dest_dir)
            log.append({"id": f"outfit.{pick}", "path": str((dest_dir / pick).relative_to(REPO)), "package": "Modular Outfits Fantasy", "role": "outfit"})
    return log


def import_monsters() -> list[dict]:
    log: list[dict] = []
    mapping = {"ghost": "Ghost.gltf", "orc": "Orc.gltf", "blob": "GreenBlob.gltf"}
    with zipfile.ZipFile(PACKAGES["monsters"]) as zf:
        for role, file_name in mapping.items():
            member = zip_find(zf, file_name)
            dest_dir = ASSETS / "creatures" / "monsters" / role
            extract_gltf_bundle(zf, member, dest_dir)
            log.append({"id": f"monster.{role}", "path": str((dest_dir / file_name).relative_to(REPO)), "package": "Ultimate Monsters", "role": role})
    return log


def import_village_samples() -> list[dict]:
    log: list[dict] = []
    dest_dir = ASSETS / "environment" / "village"
    with zipfile.ZipFile(PACKAGES["village"]) as zf:
        count = extract_zip_folder(zf, "glTF", dest_dir)
        log.append(
            {
                "id": "village.gltf_folder",
                "path": str(dest_dir.relative_to(REPO)),
                "package": "Medieval Village MegaKit",
                "role": "village",
                "files": count,
            }
        )
    return log


def import_vfx_textures() -> list[dict]:
    log: list[dict] = []
    with zipfile.ZipFile(PACKAGES["vfx_kenney"]) as zf:
        for member in zf.namelist():
            if not member.lower().endswith(".png"):
                continue
            name = Path(member).name
            if name.startswith("._"):
                continue
            dest = ASSETS / "vfx" / "textures" / "kenney" / name
            extract_member(zf, member, dest)
        log.append({"id": "vfx.kenney_pack", "path": str((ASSETS / "vfx" / "textures" / "kenney").relative_to(REPO)), "package": "kenney_particle-pack", "role": "particles"})
    with zipfile.ZipFile(PACKAGES["vfx_brackeys"]) as zf:
        for member in zf.namelist():
            low = member.lower()
            if not (low.endswith(".png") or low.endswith(".jpg")):
                continue
            name = Path(member).name
            dest = ASSETS / "vfx" / "textures" / "brackeys" / name
            extract_member(zf, member, dest)
        log.append({"id": "vfx.brackeys", "path": str((ASSETS / "vfx" / "textures" / "brackeys").relative_to(REPO)), "package": "brackeys_vfx_bundle", "role": "particles"})
    return log


def import_nature_samples() -> list[dict]:
    log: list[dict] = []
    dest_dir = ASSETS / "environment" / "nature"
    with zipfile.ZipFile(PACKAGES["nature"]) as zf:
        count = extract_zip_folder(zf, "glTF", dest_dir)
        log.append(
            {
                "id": "nature.gltf_folder",
                "path": str(dest_dir.relative_to(REPO)),
                "package": "Ultimate Stylized Nature",
                "role": "environment",
                "files": count,
            }
        )
    return log


def main() -> None:
    assets: list[dict] = []
    assets.extend(import_animals())
    assets.extend(import_ual2())
    assets.extend(import_bodies())
    assets.extend(import_outfits())
    assets.extend(import_monsters())
    assets.extend(import_nature_samples())
    assets.extend(import_village_samples())
    assets.extend(import_vfx_textures())
    manifest = {"version": "0.5.0", "assets": assets}
    out = ASSETS / "asset-manifest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Imported {len(assets)} assets -> {out.relative_to(REPO)}")


if __name__ == "__main__":
    main()
