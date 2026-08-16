import re


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into chunks of roughly chunk_size characters."""
    if not text.strip():
        return []

    paragraphs = re.split(r"\n\s*\n", text.strip())
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        while len(para) > chunk_size:
            split_at = para.rfind(" ", 0, chunk_size)
            if split_at == -1:
                split_at = chunk_size
            chunks.append(para[:split_at].strip())
            para = para[split_at:].strip()

        if current_chunk:
            tentative = current_chunk + "\n\n" + para
            if len(tentative) <= chunk_size:
                current_chunk = tentative
            else:
                chunks.append(current_chunk.strip())
                overlap_text = current_chunk[-overlap:] if overlap > 0 else ""
                current_chunk = overlap_text + "\n\n" + para if overlap_text else para
        else:
            current_chunk = para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return [c for c in chunks if c.strip()]