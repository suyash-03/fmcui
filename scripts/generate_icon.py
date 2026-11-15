"""Generate the macOS app icon and web icon from one simple mark.

Run on macOS with Pillow installed: python3 scripts/generate_icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
SCALE = 4
SIZE = 1024


def main() -> None:
    canvas = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        (64 * SCALE, 64 * SCALE, 960 * SCALE, 960 * SCALE),
        radius=224 * SCALE,
        fill=(255, 255, 255, 255),
        outline=(225, 222, 226, 255),
        width=2 * SCALE,
    )

    # A lighter serif f stays legible at Dock size without resembling Facebook's mark.
    font = ImageFont.truetype(FONT, 760 * SCALE, index=0)  # Baskerville Regular
    mask = Image.new("L", (1600 * SCALE, 1600 * SCALE), 0)
    ImageDraw.Draw(mask).text((0, 0), "f", font=font, fill=255)
    letter = mask.crop(mask.getbbox())
    x = (canvas.width - letter.width) // 2
    y = (canvas.height - letter.height) // 2 - 4 * SCALE
    canvas.paste((25, 23, 27, 255), (x, y), letter)

    icon = canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    icon.save(ROOT / "build" / "icon.png", optimize=True)
    icon.save(ROOT / "public" / "icon.png", optimize=True)


if __name__ == "__main__":
    main()
