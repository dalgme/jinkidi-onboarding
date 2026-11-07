"""출력 파일명 패턴."""

from __future__ import annotations

import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any

INVALID_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}


def sanitize(part: str, max_len: int = 80) -> str:
    """Windows/Mac 모두에서 안전한 파일명 조각."""
    part = unicodedata.normalize("NFC", part)  # Mac 에서 만든 자모 분리 한글 정리
    part = INVALID_CHARS.sub("_", part)
    part = re.sub(r"\s+", " ", part).strip(" ._")
    if part.upper() in RESERVED:
        part = f"_{part}"
    return part[:max_len] or "_"


def build_filename(
    config: dict[str, Any],
    *,
    name: str,
    doctype: str,
    seq: int,
    bank: str = "",
    period: str = "",
    written: str = "",
    extras: list[str] | None = None,
) -> str:
    extra_parts = [sanitize(e) for e in (extras or []) if e]
    values = {
        "name": sanitize(name),
        "doctype": sanitize(doctype),
        "seq": seq,
        "bank": sanitize(bank) if bank else "",
        "period": sanitize(period) if period else "",
        "date": sanitize(written) if written else "",
        "today": date.today().strftime("%Y%m%d"),
        "extra": "".join(f"_{p}" for p in extra_parts),
    }
    try:
        stem = str(config["filename_pattern"]).format(**values)
    except (KeyError, IndexError, ValueError) as exc:
        raise ValueError(f"filename_pattern 설정이 잘못되었습니다: {exc}") from exc
    stem = re.sub(r"_+", "_", sanitize(stem, max_len=150)).strip("_")
    return f"{stem}.pdf"


def unique_path(folder: Path, filename: str) -> Path:
    candidate = folder / filename
    stem, suffix = candidate.stem, candidate.suffix
    counter = 2
    while candidate.exists():
        candidate = folder / f"{stem}({counter}){suffix}"
        counter += 1
    return candidate
