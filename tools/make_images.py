"""Generate brand images: favicons and app icons (from the real logo) and the social share image.

Run once, or whenever branding changes:  python tools/make_images.py
Writes into src/public/. Requires Pillow.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "src" / "public"
RED, DEEP, INK, WHITE = "#d71920", "#a8121a", "#1c1617", "#ffffff"
FONT_DIRS = [Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu"), Path("/Library/Fonts")]


def font(names, size):
    for d in FONT_DIRS:
        for n in names:
            if (d / n).exists():
                return ImageFont.truetype(str(d / n), size)
    return ImageFont.load_default(size)


BOLD = ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
BLACK = ["seguibl.ttf", "ariblk.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
REG = ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]


def brand_mark():
    """The logo's own symbol: the red speed-swoosh flowing into the "S" of SPRINT.

    Cut from logo-sprint.png (made by optimize_photos.py): keep red pixels only (drops the black
    "Micro-Credit" text), stop at the gap between the S and the P, and drop "Always Ahead" below.
    """
    logo = Image.open(PUB / "assets" / "img" / "logo-sprint.png").convert("RGBA")
    px = logo.load()
    W, H = logo.size

    def is_red(p):
        r, g, b, a = p
        return a > 40 and r > 140 and r - max(g, b) > 40

    # first empty column after the S, within the SPRINT word band
    band = range(5, int(H * 0.48))
    cut = next(x for x in range(int(W * 0.38), int(W * 0.52)) if not any(is_red(px[x, y]) for y in band))
    mark = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    mp = mark.load()
    for y in range(H):
        for x in range(cut):
            if is_red(px[x, y]) and not (x > W * 0.39 and y > H * 0.52):
                mp[x, y] = px[x, y]
    return mark.crop(mark.getbbox())


MARK = None


def icon(size, pad=0.13, rounded=True):
    """Brand mark centred on white. Rounded tile for browser favicons; full square for app icons
    (iOS and Android apply their own mask, so those get extra padding to stay in the safe zone)."""
    global MARK
    MARK = MARK or brand_mark()
    s = 4  # supersample for smooth edges
    S = size * s
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=WHITE)
    else:
        d.rectangle([0, 0, S, S], fill=WHITE)
    inner = int(S * (1 - 2 * pad))
    k = inner / max(MARK.size)  # scale up or down to fill the safe area (thumbnail() only shrinks)
    m = MARK.resize((round(MARK.width * k), round(MARK.height * k)), Image.LANCZOS)
    im.paste(m, ((S - m.width) // 2, (S - m.height) // 2), m)
    return im.resize((size, size), Image.LANCZOS)


def og_image():
    """Share card: real team photo, red gradient panel, real logo on a white plate."""
    W, H = 1200, 630
    photo = ImageOps.exif_transpose(Image.open(ROOT / "SPRINT 1-0017.jpg")).convert("RGB")
    PW = 700  # photo occupies the right side; text sits on solid red
    photo = ImageOps.fit(photo, (PW, H), Image.LANCZOS, centering=(0.62, 0.3))
    im = Image.new("RGB", (W, H), RED)
    mask = Image.new("L", (PW, 1))
    for x in range(PW):
        mask.putpixel((x, 0), min(255, int(255 * x / 160)))  # soft fade-in over the first 160px
    im.paste(photo, (W - PW, 0), mask.resize((PW, H)))
    d = ImageDraw.Draw(im)
    logo = Image.open(PUB / "assets" / "img" / "logo-sprint.png").convert("RGBA")
    logo.thumbnail((280, 120))
    plate = Image.new("RGBA", (logo.width + 36, logo.height + 28), (255, 255, 255, 255))
    plate.paste(logo, (18, 14), logo)
    im.paste(plate, (70, 64))
    d.text((70, 250), "Emergency", font=font(BLACK, 66), fill=WHITE)
    d.text((70, 322), "cash,", font=font(BLACK, 66), fill=WHITE)
    d.text((70, 394), "same day.", font=font(BLACK, 66), fill="#ffd9db")
    d.text((70, 492), "Quick loans for salaried workers", font=font(REG, 28), fill=WHITE)
    d.text((70, 534), json.loads((ROOT / "src" / "site.json").read_text(encoding="utf-8"))["phone"], font=font(BOLD, 30), fill=WHITE)
    return im


def main():
    # Browser tab icons
    icon(48).save(PUB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    icon(32).save(PUB / "favicon-32.png")
    # Home-screen / app icons (full square; the OS rounds them)
    icon(180, pad=0.14, rounded=False).convert("RGB").save(PUB / "apple-touch-icon.png")
    icon(192, pad=0.2, rounded=False).save(PUB / "icon-192.png")
    icon(512, pad=0.2, rounded=False).save(PUB / "icon-512.png")
    og_image().save(PUB / "assets" / "img" / "og-image.png", optimize=True)
    # Retire the old placeholder "S" mark
    for old in (PUB / "favicon.svg", PUB / "assets" / "img" / "logo.svg", PUB / "assets" / "img" / "logo.png"):
        old.unlink(missing_ok=True)
    print("Images written to src/public/")


if __name__ == "__main__":
    main()
