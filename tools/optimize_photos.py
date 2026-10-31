"""Resize the owner's photos into web-ready responsive sets.

    python tools/optimize_photos.py

Reads originals from the project root (as supplied by Sprint) and writes
  src/public/assets/img/photos/<slug>-<width>.webp  (+ .jpg, or .png for cut-outs)
  src/photos.json   manifest used by build.mjs to emit <picture> tags
Also produces the real logo (transparent PNG + WebP) and copies the promo video.
Requires Pillow. Safe to re-run; outputs are overwritten.
"""
import json
import shutil
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "public" / "assets" / "img" / "photos"
IMG = ROOT / "src" / "public" / "assets" / "img"
WIDTHS = [480, 800, 1200, 1600]

# slug -> source file. Only curated images ship; admin screenshots and duplicates are left out.
PHOTOS = {
    # Real Sprint team & office (photoshoot)
    "team-group": "SPRINT 1-0017.jpg",
    "team-wide": "SPRINT 1-0008.jpg",
    "team-desk": "SPRINT 1-0023.jpg",
    "staff-duo": "SPRINT 1-0036.jpg",
    "staff-smile": "SPRINT 1-0050.jpg",
    "staff-man": "SPRINT 1-0065.jpg",
    "staff-woman": "SPRINT 1-0067.jpg",
    # Management headshots
    "ceo-samuel-gbor": "Samuel-Sprint Micro-Credit.jpg",
    "hr-victoria-sacker": "Victoria-Sprint Micro-Credit.jpg",
    "credit-jubilant-king-david": "Jubilant-Sprint Micr-Credit.jpg",
    # Campaign / lifestyle images
    "hero-phone": "Hero-Sprint-Phone.jpg",
    "hero-team": "Hero-Sprint-Team.jpg",
    "banner-cedis": "Banner-Cedis.jpg",
    "hero-banner": "Sprint Banner.jpg",
    "loan-red": "Loan-Sprint Micro-Finance.jpg",
    "convenience": "Covenience.jpg",
    "services": "Our Services.jpg",
    "repayment": "repayment.jpg",
    "same-day": "Sameday-disbursement.jpg",
    "stressed": "Sprint Micro-Finance_Loans.jpg",
    "surprised": "Sprint-offer.jpg",
    "phone-laptop": "CTA.jpg",
    "professional": "About-Us.jpg",
    # Transparent cut-outs
    "pointing": "Sprint-CTA.png",
    "jump": "Sprint.png",
    "phone-call": "CTA.png",
}


def save_set(slug, im):
    alpha = im.mode == "RGBA"
    widths = [w for w in WIDTHS if w < im.width] + [min(im.width, WIDTHS[-1])]
    widths = sorted(set(widths))
    for w in widths:
        r = im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(OUT / f"{slug}-{w}.webp", quality=78, method=6)
        if alpha:
            r.save(OUT / f"{slug}-{w}.png", optimize=True)
        else:
            r.convert("RGB").save(OUT / f"{slug}-{w}.jpg", quality=80, optimize=True, progressive=True)
    return {"w": im.width, "h": im.height, "widths": widths, "alpha": alpha}


def logo():
    """Crop Sprint.jpg to its artwork, and knock out the white background."""
    im = Image.open(ROOT / "Sprint.jpg").convert("RGB")
    im = im.crop((12, 12, im.width - 12, im.height - 12))  # source has a grey frame; artwork sits well inside
    rgba = im.convert("RGBA")
    px = rgba.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            light = min(r, g, b)
            # soft threshold so anti-aliased edges stay smooth
            a = 255 if light < 200 else max(0, round(255 * (250 - light) / 50)) if light < 250 else 0
            px[x, y] = (r, g, b, a)
    # bbox of clearly-opaque pixels only, so faint JPEG noise does not widen the crop
    rgba = rgba.crop(rgba.getchannel("A").point(lambda v: 255 if v > 60 else 0).getbbox())
    pad = 4
    canvas = Image.new("RGBA", (rgba.width + 2 * pad, rgba.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(rgba, (pad, pad))
    canvas.save(IMG / "logo-sprint.png", optimize=True)
    canvas.save(IMG / "logo-sprint.webp", quality=90, method=6)
    print("logo", canvas.size)
    return canvas.size


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for slug, name in PHOTOS.items():
        im = ImageOps.exif_transpose(Image.open(ROOT / name))
        has_alpha = "A" in im.getbands() or (im.mode == "P" and "transparency" in im.info)
        im = im.convert("RGBA" if has_alpha else "RGB")
        manifest[slug] = save_set(slug, im)
        print(f"{slug:28s} {manifest[slug]['w']}x{manifest[slug]['h']}  {manifest[slug]['widths']}")
    lw, lh = logo()
    manifest["_logo"] = {"w": lw, "h": lh}
    (ROOT / "src" / "photos.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    video = ROOT / "Sprint_Video.mp4"
    if video.exists():
        (ROOT / "src" / "public" / "assets" / "video").mkdir(parents=True, exist_ok=True)
        shutil.copy(video, ROOT / "src" / "public" / "assets" / "video" / "sprint-office-tour.mp4")


if __name__ == "__main__":
    main()
