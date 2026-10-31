"""Generate raster brand images (favicons, app icons, social share image).

Run once, or whenever branding changes:  python tools/make_images.py
Writes into src/public/. Requires Pillow.
"""
import shutil
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


def icon(size, bg=RED, fg=WHITE):
    s = 4  # supersample for smooth edges
    S = size * s
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.25), fill=bg)
    f = font(BLACK, int(S * 0.72))
    d.text((S * 0.46, S * 0.50), "S", font=f, fill=fg, anchor="mm")
    # forward arrow, bottom-right ("Always Ahead")
    u = S / 64
    d.polygon([(40 * u, 46 * u), (52 * u, 46 * u), (48 * u, 41.5 * u), (56 * u, 34 * u), (44 * u, 34 * u), (48 * u, 38.5 * u)], fill=fg)
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
    d.text((70, 534), "059 211 1441", font=font(BOLD, 30), fill=WHITE)
    return im


def main():
    shutil.copy(PUB / "assets" / "img" / "logo.svg", PUB / "favicon.svg")
    icon(32).save(PUB / "favicon-32.png")
    icon(180).save(PUB / "apple-touch-icon.png")
    icon(192).save(PUB / "icon-192.png")
    icon(512).save(PUB / "icon-512.png")
    icon(512).save(PUB / "assets" / "img" / "logo.png")
    og_image().save(PUB / "assets" / "img" / "og-image.png", optimize=True)
    print("Images written to src/public/")


if __name__ == "__main__":
    main()
