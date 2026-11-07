"""전체 처리 흐름.

  원본 루트/
    홍길동/  (이력서.hwp, 통장.jpg, 서류모음.pdf ...)
    김철수/
  ↓
  통합 폴더/
    홍길동/  홍길동_이력서_01.pdf, 홍길동_통장사본_01_KB국민은행.pdf, 홍길동_신분증사본_01.pdf
    _작업파일/홍길동/  (변환된 중간 PDF + 페이지 텍스트 캐시)
    검수보고서.csv / 페이지분류.csv / 강사별요약.csv / 처리로그.txt
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import shutil
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import pymupdf
from PIL import Image

from .classifier import (
    UNKNOWN,
    PageInfo,
    classify_page,
    extract_period,
    extract_written_date,
    filename_hint_scores,
    find_bank,
    mark_boundaries,
    smooth_file_pages,
    squash,
)
from .config import label_to_key
from .converter import ConversionError, Converter
from .naming import build_filename, sanitize, unique_path
from .ocr import OcrFunc, build_ocr

WORK_DIR = "_작업파일"
DOC_REPORT = "검수보고서.csv"
PAGE_REPORT = "페이지분류.csv"
SUMMARY_REPORT = "강사별요약.csv"
LOG_FILE = "처리로그.txt"
EXCLUDE_LABEL = "제외"

PAGE_COLUMNS = [
    "강사", "원본파일", "작업파일", "페이지", "자동분류", "신뢰도", "자동문서시작",
    "수정분류", "수정문서시작", "최종분류", "출력파일", "검수필요", "비고", "텍스트미리보기",
]
DOC_COLUMNS = ["강사", "출력파일", "서류종류", "페이지수", "원본파일", "원본페이지", "변환방식", "검수필요", "사유"]

LogFunc = Callable[[str], None]
ProgressFunc = Callable[[int, int, str], None]


def natural_key(text: str) -> list[Any]:
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", text)]


@dataclass
class Document:
    doc_type: str
    pages: list[PageInfo] = field(default_factory=list)
    output: str = ""
    needs_review: bool = False
    reasons: list[str] = field(default_factory=list)


@dataclass
class InstructorResult:
    name: str
    files_total: int = 0
    files_failed: list[str] = field(default_factory=list)
    files_skipped: list[str] = field(default_factory=list)
    methods: dict[str, str] = field(default_factory=dict)        # 작업파일 → 변환방식
    conv_warnings: dict[str, list[str]] = field(default_factory=dict)
    pages: list[PageInfo] = field(default_factory=list)
    documents: list[Document] = field(default_factory=list)


@dataclass
class RunSummary:
    output_root: Path
    instructors: list[InstructorResult] = field(default_factory=list)
    cancelled: bool = False
    ocr_engine: str = ""


class Pipeline:
    def __init__(
        self,
        config: dict[str, Any],
        log: LogFunc | None = None,
        progress: ProgressFunc | None = None,
        cancel: threading.Event | None = None,
    ) -> None:
        self.config = config
        self._log_cb = log or print
        self.progress = progress or (lambda _i, _n, _m: None)
        self.cancel = cancel or threading.Event()
        self._log_lines: list[str] = []
        self.ocr: OcrFunc | None = None
        self.ocr_name = ""

    # ------------------------------------------------------------------ 공통
    def log(self, message: str) -> None:
        line = f"[{datetime.now():%H:%M:%S}] {message}"
        self._log_lines.append(line)
        self._log_cb(line)

    def label(self, key: str) -> str:
        if key == UNKNOWN:
            return str(self.config["unknown_label"])
        return str(self.config["doc_types"][key]["label"])

    def is_ignored(self, path: Path) -> bool:
        name = path.name.lower()
        if name in [n.lower() for n in self.config["ignore_names"]]:
            return True
        if any(path.name.startswith(p) for p in self.config["ignore_prefixes"]):
            return True
        return path.name.startswith(".")

    # ------------------------------------------------------------------ 경로 검사
    @staticmethod
    def default_output(source_root: Path) -> Path:
        return source_root.parent / f"{source_root.name}_통합"

    @staticmethod
    def validate_paths(source_root: Path, output_root: Path) -> None:
        src, out = source_root.resolve(), output_root.resolve()
        if not src.is_dir():
            raise ValueError(f"원본 폴더가 없습니다: {src}")
        if src == out:
            raise ValueError("원본 폴더와 통합 폴더가 같을 수 없습니다.")
        if src.is_relative_to(out):
            raise ValueError("통합 폴더가 원본 폴더를 포함하고 있습니다. 다른 위치를 지정하세요.")
        if out.is_relative_to(src) and out.parent != src:
            raise ValueError("통합 폴더를 강사 폴더 안에 만들 수 없습니다.")

    def instructor_dirs(self, source_root: Path, output_root: Path) -> list[Path]:
        out = output_root.resolve()
        dirs = [
            d for d in source_root.iterdir()
            if d.is_dir() and not self.is_ignored(d) and d.resolve() != out
        ]
        return sorted(dirs, key=lambda d: natural_key(d.name))

    # ------------------------------------------------------------------ 실행
    def run(self, source_root: Path, output_root: Path | None = None) -> RunSummary:
        source_root = Path(source_root)
        output_root = Path(output_root) if output_root else self.default_output(source_root)
        self.validate_paths(source_root, output_root)
        output_root.mkdir(parents=True, exist_ok=True)
        summary = RunSummary(output_root)

        self.ocr, self.ocr_name = build_ocr(self.config)
        summary.ocr_engine = self.ocr_name
        self.log(f"원본 폴더: {source_root}")
        self.log(f"통합 폴더: {output_root}")
        self.log(f"OCR 엔진: {self.ocr_name}")

        loose = [p for p in source_root.iterdir() if p.is_file() and not self.is_ignored(p)]
        if loose:
            self.log(f"⚠ 강사 폴더 밖에 있는 파일 {len(loose)}개는 처리하지 않습니다: "
                     + ", ".join(p.name for p in loose[:5]) + (" ..." if len(loose) > 5 else ""))

        dirs = self.instructor_dirs(source_root, output_root)
        if not dirs:
            self.log("처리할 강사 폴더가 없습니다.")
        with Converter(self.config, self.log) as converter:
            for index, folder in enumerate(dirs, start=1):
                if self.cancel.is_set():
                    summary.cancelled = True
                    self.log("사용자가 중지했습니다.")
                    break
                self.progress(index - 1, len(dirs), folder.name)
                self.log(f"━━ ({index}/{len(dirs)}) {folder.name}")
                try:
                    result = self.process_instructor(folder, output_root, converter)
                except Exception as exc:  # noqa: BLE001 - 한 강사 실패가 전체를 멈추지 않도록
                    self.log(f"✖ {folder.name} 처리 중 오류: {exc}")
                    result = InstructorResult(sanitize(folder.name), files_failed=[f"(폴더 전체) {exc}"])
                summary.instructors.append(result)
        self.progress(len(dirs), len(dirs), "완료")
        self.write_reports(summary)
        return summary

    def process_instructor(self, folder: Path, output_root: Path, converter: Converter) -> InstructorResult:
        name = sanitize(folder.name)
        result = InstructorResult(name)
        work_dir = output_root / WORK_DIR / name
        if work_dir.exists():
            shutil.rmtree(work_dir)
        work_dir.mkdir(parents=True)

        files = sorted(
            (
                p for p in folder.rglob("*")
                if p.is_file() and not any(self.is_ignored(Path(part)) for part in p.relative_to(folder).parts)
            ),
            key=lambda p: natural_key(str(p.relative_to(folder))),
        )
        result.files_total = len(files)
        keep = self._dedupe(folder, files, result)
        for number, path in enumerate(files, start=1):
            if self.cancel.is_set():
                break
            rel = str(path.relative_to(folder))
            if path not in keep:
                continue
            work_pdf = work_dir / f"{number:03d}_{sanitize(path.stem, 60)}.pdf"
            try:
                conv = converter.convert(path, work_pdf)
            except ConversionError as exc:
                result.files_failed.append(f"{rel}: {exc}")
                self.log(f"  ✖ 변환 실패: {rel} → {exc}")
                continue
            except Exception as exc:  # noqa: BLE001
                result.files_failed.append(f"{rel}: {exc}")
                self.log(f"  ✖ 변환 오류: {rel} → {exc}")
                continue
            work_rel = str(work_pdf.relative_to(output_root))
            result.methods[work_rel] = conv.method
            if conv.warnings:
                result.conv_warnings[work_rel] = conv.warnings
            self.log(f"  ✔ 변환({conv.method}): {rel}")
            pages = self.analyze(work_pdf, work_rel, rel, needs_review=conv.needs_review)
            result.pages.extend(pages)

        self.build_documents(result)
        self.write_documents(result, output_root)
        return result

    def _dedupe(self, folder: Path, files: list[Path], result: InstructorResult) -> set[Path]:
        """지원 형식만 남기고, 내용이 완전히 같은 파일은 하나만 처리한다.

        같은 파일이 여러 이름으로 있으면 서류 종류를 알 수 있는 이름(예: '통장사본.jpg')을 우선한다.
        """
        groups: dict[str, list[Path]] = {}
        for path in files:
            rel = str(path.relative_to(folder))
            if not Converter.is_supported(path):
                result.files_skipped.append(f"{rel} (지원하지 않는 형식)")
                self.log(f"  - 건너뜀(형식): {rel}")
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            groups.setdefault(digest, []).append(path)
        keep: set[Path] = set()
        for group in groups.values():
            chosen = next((p for p in group if filename_hint_scores(p.stem, self.config)), group[0])
            keep.add(chosen)
            for other in group:
                if other is not chosen:
                    rel, kept = other.relative_to(folder), chosen.relative_to(folder)
                    result.files_skipped.append(f"{rel} (중복: {kept})")
                    self.log(f"  - 건너뜀(완전히 같은 파일): {rel} = {kept}")
        return keep

    # ------------------------------------------------------------------ 분석
    def _ocr_page(self, page: pymupdf.Page, clip: pymupdf.Rect | None = None) -> str:
        if not self.ocr:
            return ""
        pix = page.get_pixmap(dpi=int(self.config["ocr_dpi"]), clip=clip)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        try:
            return self.ocr(img)
        except Exception as exc:  # noqa: BLE001
            self.log(f"    OCR 오류: {exc}")
            return ""

    def analyze(self, work_pdf: Path, work_rel: str, source_rel: str, needs_review: bool = False) -> list[PageInfo]:
        cache_entries: list[dict[str, Any]] = []
        pages: list[PageInfo] = []
        with pymupdf.open(work_pdf) as doc:
            for index, page in enumerate(doc):
                rect = page.rect
                top_clip = pymupdf.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + rect.height * 0.25)
                text = page.get_text("text")
                top = page.get_text("text", clip=top_clip)
                ocr_used = False
                if len(squash(text)) < int(self.config["ocr_min_chars"]) and self.ocr:
                    ocr_text = self._ocr_page(page)
                    if len(squash(ocr_text)) > len(squash(text)):
                        text = ocr_text
                        top = self._ocr_page(page, top_clip)
                        ocr_used = True
                image_only = len(squash(text)) < int(self.config["ocr_min_chars"]) // 2
                cache_entries.append({"text": text, "top_text": top, "ocr": ocr_used, "image_only": image_only})
                info = PageInfo(work_rel, index, source_rel, text=text, top_text=top,
                                ocr_used=ocr_used, image_only=image_only)
                if needs_review:
                    info.needs_review = True
                    info.notes.append("서식 손실 변환")
                pages.append(info)
        Path(str(work_pdf) + ".json").write_text(
            json.dumps({"source": source_rel, "pages": cache_entries}, ensure_ascii=False), encoding="utf-8"
        )
        hints = filename_hint_scores(Path(source_rel).stem, self.config)
        for info in pages:
            classify_page(info, hints, self.config)
        smooth_file_pages(pages)
        mark_boundaries(pages, self.config)
        for info in pages:
            self.log(f"    p{info.page_index + 1}: {self.label(info.doc_type)}"
                     + (" (새 문서)" if info.start_new else "")
                     + (" [검수필요]" if info.needs_review else ""))
        return pages

    # ------------------------------------------------------------------ 문서 묶기/저장
    @staticmethod
    def build_documents(result: InstructorResult) -> None:
        documents: list[Document] = []
        current: Document | None = None
        for page in result.pages:
            if page.excluded:
                continue
            if current is None or page.start_new or page.doc_type != current.doc_type:
                current = Document(page.doc_type)
                documents.append(current)
            current.pages.append(page)
        for doc in documents:
            doc.needs_review = doc.doc_type == UNKNOWN or any(p.needs_review for p in doc.pages)
            reasons: list[str] = []
            for p in doc.pages:
                for note in p.notes:
                    if note not in reasons:
                        reasons.append(note)
            doc.reasons = reasons
        result.documents = documents

    def _extras(self, doc: Document) -> dict[str, str]:
        text = "\n".join(p.text for p in doc.pages)
        source_stem = Path(doc.pages[0].source_name).stem
        values = {"bank": "", "period": "", "written": ""}
        if doc.doc_type == "bank":
            fields = self.config.get("bank_extra_fields", [])
            if "bank" in fields:
                values["bank"] = find_bank(text) or find_bank(source_stem)
            if "period" in fields:
                values["period"] = extract_period(text, source_stem)
        elif doc.doc_type == "resume":
            if "date" in self.config.get("resume_extra_fields", []):
                values["written"] = extract_written_date(text, source_stem)
        return values

    def write_documents(self, result: InstructorResult, output_root: Path) -> None:
        target = output_root / result.name
        if target.exists():
            # 이 프로그램이 만든 통합 폴더 안이므로 이전 결과만 지운다
            shutil.rmtree(target)
        target.mkdir(parents=True)
        counters: dict[str, int] = {}
        opened: dict[str, pymupdf.Document] = {}
        try:
            for doc in result.documents:
                counters[doc.doc_type] = counters.get(doc.doc_type, 0) + 1
                extras = self._extras(doc)
                extra_list = [extras["bank"], extras["period"], extras["written"]]
                filename = build_filename(
                    self.config, name=result.name, doctype=self.label(doc.doc_type), seq=counters[doc.doc_type],
                    bank=extras["bank"], period=extras["period"], written=extras["written"], extras=extra_list,
                )
                out_path = unique_path(target, filename)
                pdf = pymupdf.open()
                for page in doc.pages:
                    src = opened.get(page.work_file)
                    if src is None:
                        src = pymupdf.open(output_root / page.work_file)
                        opened[page.work_file] = src
                    pdf.insert_pdf(src, from_page=page.page_index, to_page=page.page_index)
                pdf.save(out_path, garbage=3, deflate=True)
                pdf.close()
                doc.output = str(out_path.relative_to(output_root))
                self.log(f"  → {out_path.name} ({len(doc.pages)}쪽)" + (" [검수필요]" if doc.needs_review else ""))
        finally:
            for src in opened.values():
                src.close()

    # ------------------------------------------------------------------ 보고서
    def _write_csv(self, path: Path, columns: list[str], rows: list[dict[str, Any]]) -> Path:
        try:
            handle = path.open("w", encoding="utf-8-sig", newline="")
        except PermissionError:
            path = path.with_name(f"{path.stem}_{datetime.now():%Y%m%d_%H%M%S}{path.suffix}")
            self.log(f"⚠ 원래 보고서 파일이 열려 있어(엑셀 등) {path.name} 으로 저장합니다.")
            handle = path.open("w", encoding="utf-8-sig", newline="")
        with handle:
            writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        return path

    def write_reports(self, summary: RunSummary, page_overrides: dict[tuple[str, int], dict[str, str]] | None = None) -> None:
        out = summary.output_root
        page_rows: list[dict[str, Any]] = []
        doc_rows: list[dict[str, Any]] = []
        summary_rows: list[dict[str, Any]] = []
        overrides = page_overrides or {}
        for inst in summary.instructors:
            page_output: dict[tuple[str, int], str] = {}
            for doc in inst.documents:
                for p in doc.pages:
                    page_output[(p.work_file, p.page_index)] = doc.output
                pages_desc = ", ".join(
                    f"{Path(p.source_name).name} p{p.page_index + 1}" for p in doc.pages[:6]
                ) + (" ..." if len(doc.pages) > 6 else "")
                methods = sorted({inst.methods.get(p.work_file, "") for p in doc.pages} - {""})
                doc_rows.append({
                    "강사": inst.name,
                    "출력파일": doc.output,
                    "서류종류": self.label(doc.doc_type),
                    "페이지수": len(doc.pages),
                    "원본파일": " | ".join(sorted({p.source_name for p in doc.pages})),
                    "원본페이지": pages_desc,
                    "변환방식": ", ".join(methods),
                    "검수필요": "Y" if doc.needs_review else "",
                    "사유": " / ".join(doc.reasons),
                })
            for p in inst.pages:
                key = (p.work_file, p.page_index)
                ov = overrides.get(key, {})
                auto_type = ov.get("자동분류") or self.label(p.doc_type)
                page_rows.append({
                    "강사": inst.name,
                    "원본파일": p.source_name,
                    "작업파일": p.work_file,
                    "페이지": p.page_index + 1,
                    "자동분류": auto_type,
                    "신뢰도": ov.get("신뢰도", p.confidence),
                    "자동문서시작": ov.get("자동문서시작") or ("Y" if p.start_new else "N"),
                    "수정분류": ov.get("수정분류", ""),
                    "수정문서시작": ov.get("수정문서시작", ""),
                    "최종분류": EXCLUDE_LABEL if p.excluded else self.label(p.doc_type),
                    "출력파일": page_output.get(key, ""),
                    "검수필요": "Y" if p.needs_review else "",
                    "비고": " / ".join(p.notes),
                    "텍스트미리보기": re.sub(r"\s+", " ", p.text).strip()[:80],
                })
            counts: dict[str, int] = {}
            for doc in inst.documents:
                counts[doc.doc_type] = counts.get(doc.doc_type, 0) + 1
            missing = [spec["label"] for key, spec in self.config["doc_types"].items() if not counts.get(key)]
            row: dict[str, Any] = {
                "강사": inst.name,
                "원본파일수": inst.files_total,
                "변환실패": len(inst.files_failed),
                "건너뜀": len(inst.files_skipped),
            }
            for key, spec in self.config["doc_types"].items():
                row[spec["label"]] = counts.get(key, 0)
            row[self.config["unknown_label"]] = counts.get(UNKNOWN, 0)
            row["누락서류"] = ", ".join(missing)
            row["검수필요건수"] = sum(1 for d in inst.documents if d.needs_review)
            row["실패/건너뜀 상세"] = " | ".join(inst.files_failed + inst.files_skipped)
            summary_rows.append(row)

        labels = [spec["label"] for spec in self.config["doc_types"].values()]
        summary_cols = ["강사", "원본파일수", "변환실패", "건너뜀", *labels, self.config["unknown_label"],
                        "누락서류", "검수필요건수", "실패/건너뜀 상세"]
        self._write_csv(out / PAGE_REPORT, PAGE_COLUMNS, page_rows)
        self._write_csv(out / DOC_REPORT, DOC_COLUMNS, doc_rows)
        self._write_csv(out / SUMMARY_REPORT, summary_cols, summary_rows)

        total_docs = sum(len(i.documents) for i in summary.instructors)
        review = sum(1 for i in summary.instructors for d in i.documents if d.needs_review)
        failed = sum(len(i.files_failed) for i in summary.instructors)
        self.log(f"완료: 강사 {len(summary.instructors)}명, 생성 문서 {total_docs}개, "
                 f"검수필요 {review}개, 변환실패 {failed}개")
        self.log(f"보고서: {out / SUMMARY_REPORT}")
        with (out / LOG_FILE).open("a", encoding="utf-8") as fp:
            fp.write(f"\n===== {datetime.now():%Y-%m-%d %H:%M:%S} =====\n")
            fp.write("\n".join(self._log_lines) + "\n")
        self._log_lines.clear()

    # ------------------------------------------------------------------ 보고서 반영 재생성
    def rebuild(self, output_root: Path) -> RunSummary:
        """페이지분류.csv 의 '수정분류' / '수정문서시작' 을 반영해 결과 PDF 를 다시 만든다.

        수정분류 : 이력서 / 통장사본 / 신분증사본 / 미분류 / 제외
        수정문서시작 : Y(이 페이지부터 새 문서) / N(앞 페이지와 같은 문서로 합치기)
        """
        output_root = Path(output_root)
        csv_path = output_root / PAGE_REPORT
        if not csv_path.exists():
            raise ValueError(f"{csv_path} 가 없습니다. 먼저 일반 실행을 하세요.")
        with csv_path.open("r", encoding="utf-8-sig", newline="") as fp:
            rows = list(csv.DictReader(fp))
        mapping = label_to_key(self.config)
        summary = RunSummary(output_root)
        by_name: dict[str, InstructorResult] = {}
        overrides: dict[tuple[str, int], dict[str, str]] = {}
        cache: dict[str, list[dict[str, Any]]] = {}
        prev_file: dict[str, str] = {}
        self.log(f"보고서 반영 재생성: {csv_path}")
        for row in rows:
            name = (row.get("강사") or "").strip()
            work_file = (row.get("작업파일") or "").strip()
            if not name or not work_file:
                continue
            inst = by_name.get(name)
            if inst is None:
                inst = InstructorResult(name)
                by_name[name] = inst
                summary.instructors.append(inst)
            if work_file not in cache:
                cache_path = output_root / (work_file + ".json")
                cache[work_file] = (json.loads(cache_path.read_text(encoding="utf-8"))["pages"]
                                    if cache_path.exists() else [])
            page_no = int(row.get("페이지") or 1) - 1
            entry = cache[work_file][page_no] if page_no < len(cache[work_file]) else {}
            info = PageInfo(work_file, page_no, row.get("원본파일", ""), text=entry.get("text", ""),
                            top_text=entry.get("top_text", ""), ocr_used=bool(entry.get("ocr")),
                            image_only=bool(entry.get("image_only")))
            auto_label = (row.get("자동분류") or "").strip()
            fix_label = (row.get("수정분류") or "").strip()
            chosen = fix_label or auto_label
            if chosen == EXCLUDE_LABEL:
                info.excluded = True
                info.doc_type = UNKNOWN
            elif chosen in mapping:
                info.doc_type = mapping[chosen]
            else:
                info.doc_type = UNKNOWN
                if chosen:
                    info.notes.append(f"알 수 없는 분류값 '{chosen}'")
            auto_start = (row.get("자동문서시작") or "Y").strip().upper() == "Y"
            fix_start = (row.get("수정문서시작") or "").strip().upper()
            new_file = prev_file.get(name) != work_file
            if fix_start in ("Y", "N"):
                info.start_new = fix_start == "Y"
            else:
                info.start_new = auto_start or new_file
            prev_file[name] = work_file
            if fix_label or fix_start:
                info.notes.append("수동 수정 반영")
            elif (row.get("검수필요") or "").strip().upper() == "Y":
                info.needs_review = True
                if row.get("비고"):
                    info.notes.append(str(row["비고"]))
            try:
                info.confidence = float(row.get("신뢰도") or 0)
            except ValueError:
                info.confidence = 0.0
            overrides[(work_file, page_no)] = {
                "자동분류": auto_label, "신뢰도": row.get("신뢰도", ""),
                "자동문서시작": row.get("자동문서시작", ""),
                "수정분류": fix_label, "수정문서시작": row.get("수정문서시작", ""),
            }
            inst.pages.append(info)
            inst.methods[work_file] = "재생성"

        for index, inst in enumerate(summary.instructors, start=1):
            if self.cancel.is_set():
                summary.cancelled = True
                break
            self.progress(index - 1, len(summary.instructors), inst.name)
            self.log(f"━━ {inst.name}")
            self.build_documents(inst)
            self.write_documents(inst, output_root)
        self.progress(len(summary.instructors), len(summary.instructors), "완료")
        self.write_reports(summary, overrides)
        return summary


def elapsed(start: float) -> str:
    seconds = int(time.time() - start)
    return f"{seconds // 60}분 {seconds % 60}초"
