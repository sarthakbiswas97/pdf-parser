"""Generate a mixed test PDF with native text pages and scanned-image pages.

Produces a PDF where odd pages have native selectable text and even pages
contain a rendered image of text (simulating a scanned document).
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def _create_text_image(text: str, width: int = 1600, height: int = 2000) -> Image.Image:
    """Render text as a raster image to simulate a scanned page."""
    img = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(img)

    # Use default font (always available)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    except OSError:
        font = ImageFont.load_default()

    y_offset = 60
    for line in text.split("\n"):
        draw.text((60, y_offset), line, fill="black", font=font)
        y_offset += 40

    return img


def generate_test_pdf(
    output_path: str,
    num_pages: int = 10,
) -> None:
    """Create a mixed PDF with alternating native-text and image-based pages."""
    c = canvas.Canvas(output_path, pagesize=letter)
    page_width, page_height = letter

    for page_num in range(1, num_pages + 1):
        is_text_page = page_num % 2 == 1

        if is_text_page:
            # Native text page -- selectable text
            c.setFont("Helvetica", 12)
            c.drawString(72, page_height - 72, f"Page {page_num} - Native Text")
            c.setFont("Helvetica", 10)

            y = page_height - 110
            for line_num in range(1, 30):
                c.drawString(
                    72,
                    y,
                    f"This is line {line_num} of native selectable text on page {page_num}. "
                    f"The quick brown fox jumps over the lazy dog.",
                )
                y -= 18
                if y < 72:
                    break
        else:
            # Scanned-image page -- text rendered as image
            scan_text = f"Page {page_num} - Scanned Image\n\n"
            for line_num in range(1, 25):
                scan_text += (
                    f"Line {line_num}: This text is rendered as an image,\n"
                    f"simulating a scanned document page.\n"
                )

            img = _create_text_image(scan_text)
            img_buf = io.BytesIO()
            img.save(img_buf, format="PNG")
            img_buf.seek(0)

            reader = ImageReader(img_buf)
            c.drawImage(
                reader,
                0, 0,
                width=page_width,
                height=page_height,
                preserveAspectRatio=True,
            )

        c.showPage()

    c.save()
    print(f"Generated {num_pages}-page test PDF at: {output_path}")


if __name__ == "__main__":
    num = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    out = sys.argv[2] if len(sys.argv) > 2 else str(
        Path(__file__).parent / "sample.pdf"
    )
    generate_test_pdf(out, num)
