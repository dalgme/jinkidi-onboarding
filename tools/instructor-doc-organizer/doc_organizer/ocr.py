"""스캔 이미지(텍스트가 없는 페이지)를 읽기 위한 OCR.

- tesseract : Tesseract-OCR 설치 + 한국어(kor) 데이터 필요. pip install pytesseract
- windows   : Windows 10/11 내장 OCR(한국어 Windows 는 기본 포함). pip install winocr
- auto      : tesseract → windows 순으로 사용 가능한 것을 고른다.
OCR 이 없으면 스캔 페이지는 파일명 힌트로만 분류되고, 애매하면 '미분류'로 남는다.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Callable

from PIL import Image

TESSERACT_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract",
    "/opt/homebrew/bin/tesseract",
]

OcrFunc = Callable[[Image.Image], str]


def _tesseract(config: dict[str, Any]) -> OcrFunc | None:
    try:
        import pytesseract  # type: ignore
    except ImportError:
        return None
    cmd = str(config.get("tesseract_cmd") or "").strip()
    if not cmd:
        cmd = shutil.which("tesseract") or next((c for c in TESSERACT_CANDIDATES if Path(c).exists()), "")
    if not cmd:
        return None
    pytesseract.pytesseract.tesseract_cmd = cmd
    lang = str(config.get("tesseract_lang") or "kor+eng")
    try:
        available = set(pytesseract.get_languages(config=""))
        wanted = [code for code in lang.split("+") if code in available]
        if not wanted:
            return None
        lang = "+".join(wanted)
    except Exception:  # noqa: BLE001
        return None

    def run(img: Image.Image) -> str:
        return str(pytesseract.image_to_string(img, lang=lang))

    return run


def _windows(_config: dict[str, Any]) -> OcrFunc | None:
    try:
        import winocr  # type: ignore
    except ImportError:
        return None

    def run(img: Image.Image) -> str:
        result = winocr.recognize_pil_sync(img, "ko")
        if isinstance(result, dict):
            return str(result.get("text", ""))
        return str(getattr(result, "text", ""))

    try:  # 한국어 OCR 팩이 실제로 동작하는지 확인
        run(Image.new("RGB", (64, 32), "white"))
    except Exception:  # noqa: BLE001
        return None
    return run


def build_ocr(config: dict[str, Any]) -> tuple[OcrFunc | None, str]:
    engine = str(config.get("ocr_engine") or "auto").lower()
    if engine == "none":
        return None, "사용안함"
    order = {"tesseract": [_tesseract], "windows": [_windows], "auto": [_tesseract, _windows]}.get(
        engine, [_tesseract, _windows]
    )
    names = {_tesseract: "Tesseract", _windows: "Windows OCR"}
    for factory in order:
        func = factory(config)
        if func:
            return func, names[factory]
    return None, "없음(설치 필요)"
