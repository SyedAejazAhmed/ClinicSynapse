"""
Local OCR text extraction from PDFs without a text layer.

Uses pypdfium2 for PDF rendering and rapidocr-onnxruntime for OCR.
Both are pip-installable and run fully locally.
"""

from __future__ import annotations

from pathlib import Path

import pypdfium2 as pdfium
from rapidocr_onnxruntime import RapidOCR


def extract_text_from_scanned_pdf(pdf_path: str | Path, scale: float = 2.0) -> str:
    """
    Extract text from a scanned/image-only PDF using local OCR.

    Args:
        pdf_path: Path to the PDF file.
        scale: Render scale factor. Higher values improve OCR accuracy but use more memory.

    Returns:
        Extracted text as a single string. Pages are separated by blank lines.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    ocr = RapidOCR()
    extracted_pages: list[str] = []

    pdf = pdfium.PdfDocument(str(pdf_path))
    try:
        for page_index in range(len(pdf)):
            page = pdf[page_index]
            bitmap = page.render(scale=scale)
            pil_image = bitmap.to_pil()

            result, _ = ocr(pil_image)
            if result:
                page_text = "\n".join(line[1] for line in result)
                extracted_pages.append(page_text)
            else:
                # Keep the page placeholder if no text was detected
                extracted_pages.append("")
    finally:
        pdf.close()

    return "\n\n".join(extracted_pages)


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Usage: python ocr_pdf.py <path-to-pdf>")
        raise SystemExit(1)

    text = extract_text_from_scanned_pdf(sys.argv[1])
    print(text)


"""
USAGE AS A MODULE:

from utils.pdf_to_text import extract_text_from_scanned_pdf

text = extract_text_from_scanned_pdf("scanned_document.pdf")
print(text)

"""