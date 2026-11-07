"""여러 형식의 파일을 PDF 로 변환한다.

원본은 절대 직접 열지 않는다. 항상 임시 폴더에 복사본을 만든 뒤 그 복사본을 변환한다
(Word/한글은 문서를 열 때 같은 폴더에 잠금 파일 ~$xxx 를 만들기 때문).

변환 우선순위
  PDF          : 그대로 복사(손상/암호 여부 확인)
  이미지       : Pillow + PyMuPDF (추가 프로그램 불필요)
  Office 문서  : (Windows) MS Office COM → LibreOffice
  HWP / HWPX   : (Windows) 한컴오피스 COM → LibreOffice → 텍스트 추출 대체 변환(검수필요)
"""

from __future__ import annotations

import io
import os
import platform
import shutil
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import pymupdf
from PIL import Image, ImageOps, ImageSequence

try:  # HEIC(아이폰 사진) 지원 - 선택
    from pillow_heif import register_heif_opener  # type: ignore

    register_heif_opener()
    HEIC_SUPPORTED = True
except Exception:  # noqa: BLE001
    HEIC_SUPPORTED = False

IMAGE_EXTS = {".jpg", ".jpeg", ".jfif", ".png", ".gif", ".bmp", ".tif", ".tiff", ".webp", ".heic", ".heif"}
WORD_EXTS = {".doc", ".docx", ".docm", ".rtf", ".odt", ".txt"}
EXCEL_EXTS = {".xls", ".xlsx", ".xlsm", ".csv", ".ods"}
PPT_EXTS = {".ppt", ".pptx", ".pps", ".ppsx", ".odp"}
HWP_EXTS = {".hwp", ".hwpx"}
PDF_EXTS = {".pdf"}
SUPPORTED_EXTS = IMAGE_EXTS | WORD_EXTS | EXCEL_EXTS | PPT_EXTS | HWP_EXTS | PDF_EXTS

A4 = pymupdf.paper_rect("a4")
IS_WINDOWS = platform.system() == "Windows"


class ConversionError(Exception):
    pass


@dataclass
class ConversionResult:
    output: Path
    method: str
    warnings: list[str] = field(default_factory=list)
    needs_review: bool = False


# ---------------------------------------------------------------------------
# 이미지
# ---------------------------------------------------------------------------
def _image_frames(path: Path) -> list[Image.Image]:
    with Image.open(path) as img:
        frames: list[Image.Image] = []
        if path.suffix.lower() in {".tif", ".tiff"}:
            for frame in ImageSequence.Iterator(img):
                frames.append(frame.copy())
        else:  # GIF 등 애니메이션은 첫 프레임만
            frames.append(img.copy())
    return frames


def _prepare_image(img: Image.Image, max_px: int) -> Image.Image:
    img = ImageOps.exif_transpose(img) or img
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1])
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")
    longest = max(img.size)
    if longest > max_px:
        ratio = max_px / longest
        img = img.resize((max(1, int(img.width * ratio)), max(1, int(img.height * ratio))), Image.LANCZOS)
    return img


def image_to_pdf(src: Path, dst: Path, config: dict[str, Any]) -> ConversionResult:
    try:
        frames = _image_frames(src)
    except Exception as exc:  # noqa: BLE001
        raise ConversionError(f"이미지를 열 수 없습니다: {exc}") from exc
    doc = pymupdf.open()
    for frame in frames:
        img = _prepare_image(frame, int(config["image_max_px"]))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=int(config["image_jpeg_quality"]), optimize=True)
        data = buf.getvalue()
        if config["image_fit_a4"]:
            landscape = img.width > img.height
            page_rect = pymupdf.Rect(0, 0, A4.height, A4.width) if landscape else A4
            page = doc.new_page(width=page_rect.width, height=page_rect.height)
            margin = 28  # 약 1cm
            box = pymupdf.Rect(margin, margin, page_rect.width - margin, page_rect.height - margin)
            page.insert_image(box, stream=data, keep_proportion=True)
        else:
            # 150dpi 기준 원본 크기
            w, h = img.width * 72 / 150, img.height * 72 / 150
            page = doc.new_page(width=w, height=h)
            page.insert_image(page.rect, stream=data)
    doc.save(dst, garbage=3, deflate=True)
    doc.close()
    return ConversionResult(dst, "이미지변환")


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------
def pdf_copy(src: Path, dst: Path) -> ConversionResult:
    try:
        doc = pymupdf.open(src)
    except Exception as exc:  # noqa: BLE001
        raise ConversionError(f"PDF 를 열 수 없습니다(손상 가능): {exc}") from exc
    warnings: list[str] = []
    if doc.needs_pass and not doc.authenticate(""):
        doc.close()
        raise ConversionError("암호가 걸린 PDF 입니다. 암호를 해제한 뒤 다시 실행하세요.")
    if doc.page_count == 0:
        doc.close()
        raise ConversionError("페이지가 없는 PDF 입니다.")
    # 다시 저장하면 경미한 손상이 복구되고 암호(소유자 암호)가 제거된다.
    doc.save(dst, garbage=3, deflate=True)
    doc.close()
    return ConversionResult(dst, "PDF", warnings)


# ---------------------------------------------------------------------------
# LibreOffice
# ---------------------------------------------------------------------------
def find_soffice(config: dict[str, Any]) -> str | None:
    configured = str(config.get("soffice_path") or "").strip()
    if configured and Path(configured).exists():
        return configured
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    candidates = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return None


def libreoffice_to_pdf(src: Path, dst: Path, config: dict[str, Any]) -> ConversionResult:
    soffice = find_soffice(config)
    if not soffice:
        raise ConversionError("LibreOffice 가 설치되어 있지 않습니다.")
    with tempfile.TemporaryDirectory(prefix="lo_") as tmp:
        profile = Path(tmp) / "profile"
        cmd = [
            soffice,
            f"-env:UserInstallation={profile.as_uri()}",
            "--headless", "--norestore", "--convert-to", "pdf", "--outdir", tmp, str(src),
        ]
        try:
            subprocess.run(
                cmd, capture_output=True, timeout=int(config["convert_timeout_sec"]), check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except subprocess.TimeoutExpired as exc:
            raise ConversionError("LibreOffice 변환 시간 초과") from exc
        produced = Path(tmp) / (src.stem + ".pdf")
        if not produced.exists():
            raise ConversionError("LibreOffice 가 이 파일을 변환하지 못했습니다.")
        shutil.move(str(produced), dst)
    return ConversionResult(dst, "LibreOffice")


# ---------------------------------------------------------------------------
# Windows COM (MS Office / 한컴오피스)
# ---------------------------------------------------------------------------
class ComSession:
    """COM 애플리케이션을 파일마다 새로 띄우지 않도록 재사용한다."""

    def __init__(self) -> None:
        self._apps: dict[str, Any] = {}
        self._failed: set[str] = set()
        self._initialized = False

    def _client(self) -> Any:
        import win32com.client  # type: ignore  # pywin32

        if not self._initialized:
            import pythoncom  # type: ignore

            pythoncom.CoInitialize()
            self._initialized = True
        return win32com.client

    def get(self, prog_id: str) -> Any:
        if prog_id in self._failed:
            raise ConversionError(f"{prog_id} 를 사용할 수 없습니다.")
        if prog_id not in self._apps:
            try:
                client = self._client()
                app = client.DispatchEx(prog_id)
            except Exception as exc:  # noqa: BLE001
                self._failed.add(prog_id)
                raise ConversionError(f"{prog_id} 를 실행할 수 없습니다: {exc}") from exc
            self._apps[prog_id] = app
            if prog_id == "HWPFrame.HwpObject":
                try:
                    app.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
                except Exception:  # noqa: BLE001
                    pass
                try:
                    app.XHwpWindows.Item(0).Visible = False
                except Exception:  # noqa: BLE001
                    pass
            else:
                try:
                    app.Visible = False
                except Exception:  # noqa: BLE001
                    pass
                try:
                    app.DisplayAlerts = False
                except Exception:  # noqa: BLE001
                    pass
        return self._apps[prog_id]

    def drop(self, prog_id: str) -> None:
        app = self._apps.pop(prog_id, None)
        if app is not None:
            try:
                app.Quit()
            except Exception:  # noqa: BLE001
                pass

    def close(self) -> None:
        for prog_id in list(self._apps):
            self.drop(prog_id)
        if self._initialized:
            try:
                import pythoncom  # type: ignore

                pythoncom.CoUninitialize()
            except Exception:  # noqa: BLE001
                pass


def _ms_office_to_pdf(src: Path, dst: Path, com: ComSession) -> ConversionResult:
    ext = src.suffix.lower()
    if ext in WORD_EXTS:
        app = com.get("Word.Application")
        doc = app.Documents.Open(str(src), ConfirmConversions=False, ReadOnly=True, AddToRecentFiles=False)
        try:
            doc.ExportAsFixedFormat(str(dst), 17)  # wdExportFormatPDF
        finally:
            doc.Close(False)
        return ConversionResult(dst, "MS Word")
    if ext in EXCEL_EXTS:
        app = com.get("Excel.Application")
        book = app.Workbooks.Open(str(src), ReadOnly=True, UpdateLinks=0)
        try:
            book.ExportAsFixedFormat(0, str(dst))  # xlTypePDF
        finally:
            book.Close(False)
        return ConversionResult(dst, "MS Excel")
    if ext in PPT_EXTS:
        app = com.get("PowerPoint.Application")
        pres = app.Presentations.Open(str(src), ReadOnly=True, Untitled=False, WithWindow=False)
        try:
            pres.SaveAs(str(dst), 32)  # ppSaveAsPDF
        finally:
            pres.Close()
        return ConversionResult(dst, "MS PowerPoint")
    raise ConversionError("MS Office 대상 형식이 아닙니다.")


def _hancom_to_pdf(src: Path, dst: Path, com: ComSession) -> ConversionResult:
    hwp = com.get("HWPFrame.HwpObject")
    fmt = "HWPX" if src.suffix.lower() == ".hwpx" else "HWP"
    if not hwp.Open(str(src), fmt, "forceopen:true;versionwarning:false;suspendpassword:true"):
        raise ConversionError("한글 문서를 열 수 없습니다(암호/손상 가능).")
    try:
        hwp.SaveAs(str(dst), "PDF", "")
    finally:
        try:
            hwp.Clear(1)
        except Exception:  # noqa: BLE001
            pass
    if not dst.exists():
        raise ConversionError("한글 → PDF 저장에 실패했습니다.")
    return ConversionResult(dst, "한컴오피스")


# ---------------------------------------------------------------------------
# HWP/HWPX 최후 수단: 텍스트만 추출해 PDF 로 만든다 (서식 손실 → 검수필요)
# ---------------------------------------------------------------------------
def _hwpx_text(src: Path) -> str:
    import re
    import xml.etree.ElementTree as ET

    texts: list[str] = []
    with zipfile.ZipFile(src) as zf:
        sections = sorted(n for n in zf.namelist() if re.match(r"Contents/section\d+\.xml$", n))
        for name in sections:
            root = ET.fromstring(zf.read(name))
            for para in root.iter():
                if para.tag.endswith("}p"):
                    line = "".join(t.text or "" for t in para.iter() if t.tag.endswith("}t"))
                    texts.append(line)
    return "\n".join(texts)


def _hwp_text(src: Path) -> str:
    try:
        import olefile  # type: ignore
    except ImportError as exc:
        raise ConversionError("olefile 패키지가 없어 HWP 텍스트를 추출할 수 없습니다.") from exc
    with olefile.OleFileIO(str(src)) as ole:
        if ole.exists("PrvText"):
            return ole.openstream("PrvText").read().decode("utf-16-le", errors="ignore")
    raise ConversionError("HWP 미리보기 텍스트가 없습니다.")


def text_to_pdf(text: str, dst: Path, title: str) -> None:
    doc = pymupdf.open()
    font = pymupdf.Font("korea")
    lines = [f"[자동 텍스트 변환 - 서식이 손실되었습니다: {title}]", ""] + text.splitlines()
    margin, size, leading = 50, 10, 15
    page = None
    y = 0.0
    max_width = A4.width - margin * 2
    for raw in lines:
        # 긴 줄 줄바꿈
        chunks: list[str] = []
        current = ""
        for ch in raw:
            if font.text_length(current + ch, fontsize=size) > max_width:
                chunks.append(current)
                current = ch
            else:
                current += ch
        chunks.append(current)
        for chunk in chunks:
            if page is None or y > A4.height - margin:
                page = doc.new_page(width=A4.width, height=A4.height)
                y = margin + size
            writer = pymupdf.TextWriter(page.rect)
            writer.append((margin, y), chunk, font=font, fontsize=size)
            writer.write_text(page)
            y += leading
    doc.save(dst, garbage=3, deflate=True)
    doc.close()


def hwp_text_fallback(src: Path, dst: Path) -> ConversionResult:
    text = _hwpx_text(src) if src.suffix.lower() == ".hwpx" else _hwp_text(src)
    if not text.strip():
        raise ConversionError("한글 문서에서 텍스트를 추출하지 못했습니다.")
    text_to_pdf(text, dst, src.name)
    return ConversionResult(
        dst, "텍스트추출(서식손실)",
        ["한컴오피스/LibreOffice 로 변환하지 못해 텍스트만 추출했습니다. 원본 확인 필요."],
        needs_review=True,
    )


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------
class Converter:
    def __init__(self, config: dict[str, Any], log: Callable[[str], None] | None = None) -> None:
        self.config = config
        self.log = log or (lambda _msg: None)
        self.com = ComSession() if IS_WINDOWS else None

    def close(self) -> None:
        if self.com:
            self.com.close()

    def __enter__(self) -> "Converter":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    @staticmethod
    def is_supported(path: Path) -> bool:
        return path.suffix.lower() in SUPPORTED_EXTS

    def convert(self, src: Path, dst: Path) -> ConversionResult:
        """src(원본)를 dst(PDF)로 변환. 원본은 임시 복사본으로만 다룬다."""
        ext = src.suffix.lower()
        if ext not in SUPPORTED_EXTS:
            raise ConversionError(f"지원하지 않는 형식입니다: {ext or '(확장자 없음)'}")
        if ext in {".heic", ".heif"} and not HEIC_SUPPORTED:
            raise ConversionError("HEIC 변환에는 pillow-heif 패키지가 필요합니다.")
        dst.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="docorg_") as tmp:
            # COM/LibreOffice 가 한글 경로·긴 경로에서 실패하지 않도록 짧은 영문 이름으로 복사
            work_src = Path(tmp) / f"source{ext}"
            shutil.copy2(src, work_src)
            os.chmod(work_src, 0o644)
            work_dst = Path(tmp) / "output.pdf"
            result = self._convert_copy(work_src, work_dst)
            shutil.move(str(work_dst), dst)
            result.output = dst
            return result

    def _convert_copy(self, src: Path, dst: Path) -> ConversionResult:
        ext = src.suffix.lower()
        if ext in PDF_EXTS:
            return pdf_copy(src, dst)
        if ext in IMAGE_EXTS:
            return image_to_pdf(src, dst, self.config)

        errors: list[str] = []
        attempts: list[tuple[str, Callable[[], ConversionResult]]] = []
        if ext in HWP_EXTS:
            if self.com and self.config["use_hancom"]:
                attempts.append(("한컴오피스", lambda: _hancom_to_pdf(src, dst, self.com)))  # type: ignore[arg-type]
            attempts.append(("LibreOffice", lambda: libreoffice_to_pdf(src, dst, self.config)))
            attempts.append(("텍스트추출", lambda: hwp_text_fallback(src, dst)))
        else:
            if self.com and self.config["use_ms_office"]:
                attempts.append(("MS Office", lambda: _ms_office_to_pdf(src, dst, self.com)))  # type: ignore[arg-type]
            attempts.append(("LibreOffice", lambda: libreoffice_to_pdf(src, dst, self.config)))

        for name, attempt in attempts:
            try:
                result = attempt()
                if dst.exists() and dst.stat().st_size > 0:
                    if errors:
                        result.warnings.append("앞선 변환 실패: " + " / ".join(errors))
                    return result
                errors.append(f"{name}: 결과 파일 없음")
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{name}: {exc}")
        raise ConversionError("변환 실패 → " + " / ".join(errors))
