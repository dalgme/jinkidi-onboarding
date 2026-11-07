"""페이지 단위 서류 분류와 문서 경계(분할 지점) 판정."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .config import BANK_NAMES

UNKNOWN = "unknown"

# 은행 표기 통일
BANK_ALIASES = {
    "국민은행": "KB국민은행", "KB국민은행": "KB국민은행",
    "기업은행": "IBK기업은행", "IBK기업은행": "IBK기업은행",
    "농협": "농협은행", "NH농협": "농협은행", "농협은행": "농협은행",
    "KEB하나": "하나은행", "하나은행": "하나은행",
    "제일은행": "SC제일은행", "SC제일은행": "SC제일은행",
    "한국씨티": "씨티은행", "씨티은행": "씨티은행",
    "대구은행": "iM뱅크", "iM뱅크": "iM뱅크",
}

RRN_RE = re.compile(r"\d{6}\s?-\s?[1-8][\d*]{6}")
ACCOUNT_RE = re.compile(r"(?<![\d-])(\d{2,6}(?:\s?-\s?\d{2,8}){1,4})(?![\d-])")
DATE_PART = r"((?:19|20)\d{2})\s*(?:[.\-/]|년)\s*(\d{1,2})?\s*(?:월|\.)?"
PERIOD_RE = re.compile(DATE_PART + r"\s*[~∼\-–—]\s*(?:" + DATE_PART + r"|(현재|사용\s*중|present))", re.I)
YEAR_RANGE_RE = re.compile(r"((?:19|20)\d{2})\s*년?\s*[~∼\-–—]\s*((?:19|20)\d{2}|현재)")
WRITTEN_DATE_RE = re.compile(r"((?:19|20)\d{2})\s*(?:[.\-/]|년)\s*(\d{1,2})\s*(?:[.\-/]|월)\s*(\d{1,2})\s*일?")


def squash(text: str) -> str:
    """공백 제거 + 소문자. 스캔 문서의 '이 력 서' 같은 띄어쓰기에 대응."""
    return re.sub(r"\s+", "", text).lower()


@dataclass
class PageInfo:
    work_file: str              # 작업 PDF 경로(출력 폴더 기준 상대경로)
    page_index: int             # 0부터
    source_name: str            # 원본 파일(강사 폴더 기준 상대경로)
    text: str = ""
    top_text: str = ""          # 페이지 상단 25% 영역 텍스트
    ocr_used: bool = False
    image_only: bool = False    # 텍스트가 없고 OCR 도 못 한 페이지
    doc_type: str = UNKNOWN
    confidence: float = 0.0
    scores: dict[str, float] = field(default_factory=dict)
    start_new: bool = True
    needs_review: bool = False
    notes: list[str] = field(default_factory=list)
    account: str = ""
    excluded: bool = False


# ---------------------------------------------------------------------------
# 추출 도우미
# ---------------------------------------------------------------------------
def find_accounts(text: str) -> list[str]:
    found: list[str] = []
    for match in ACCOUNT_RE.finditer(text):
        raw = re.sub(r"\s", "", match.group(1))
        digits = raw.replace("-", "")
        first = raw.split("-")[0]
        if not 10 <= len(digits) <= 16:
            continue
        if digits.startswith("01") and len(digits) <= 11:  # 휴대폰
            continue
        if first.startswith("0") and len(digits) <= 11:  # 지역번호 전화
            continue
        if RRN_RE.fullmatch(raw):  # 주민등록번호
            continue
        if re.fullmatch(r"(19|20)\d{2}-\d{1,2}-\d{1,2}", raw):  # 날짜
            continue
        found.append(raw)
    return found


def find_bank(text: str) -> str:
    for name in sorted(BANK_NAMES, key=len, reverse=True):
        if name.lower() in text.lower():
            return BANK_ALIASES.get(name, name)
    return ""


def _fmt_ym(year: str | None, month: str | None) -> str:
    if not year:
        return ""
    return f"{year}.{int(month):02d}" if month else year


def extract_period(text: str, filename: str = "") -> str:
    """'2023.01-2024.12', '2022-현재' 형태의 사용기간.

    1) 파일명  2) 본문 중 '사용' 단어 근처 기간 순으로 찾는다.
    (본문 전체에서 찾으면 거래내역 날짜를 잘못 잡기 때문)
    """
    candidates: list[str] = []
    if filename:
        candidates.append(filename)
    for match in re.finditer(r"사용", text):
        candidates.append(text[max(0, match.start() - 40): match.end() + 40])
    for chunk in candidates:
        m = PERIOD_RE.search(chunk)
        if m:
            start = _fmt_ym(m.group(1), m.group(2))
            end = m.group(5) or _fmt_ym(m.group(3), m.group(4))
            end = "현재" if end and re.match(r"(현재|사용|present)", end, re.I) else end
            if start and end:
                return f"{start}-{end}"
        m2 = YEAR_RANGE_RE.search(chunk)
        if m2:
            return f"{m2.group(1)}-{m2.group(2)}"
    return ""


def extract_written_date(text: str, filename: str = "") -> str:
    """이력서 작성일. 파일명의 날짜 또는 본문의 '작성일' / 마지막 날짜."""
    m = re.search(r"((?:19|20)\d{2})[.\-_]?(\d{2})[.\-_]?(\d{2})", filename)
    if m and 1 <= int(m.group(2)) <= 12:
        return f"{m.group(1)}.{m.group(2)}.{m.group(3)}"
    m = re.search(r"((?:19|20)\d{2})\s*년", filename)
    if m:
        return m.group(1)
    labelled = re.search(r"작\s*성\s*일\s*[:：]?\s*" + WRITTEN_DATE_RE.pattern, text)
    if labelled:
        y, mo, d = labelled.group(1), labelled.group(2), labelled.group(3)
        return f"{y}.{int(mo):02d}.{int(d):02d}"
    tail = text[-300:]
    if re.search(r"위와\s*같|상기|사실", tail):
        dates = list(WRITTEN_DATE_RE.finditer(tail))
        if dates:
            y, mo, d = dates[-1].group(1), dates[-1].group(2), dates[-1].group(3)
            return f"{y}.{int(mo):02d}.{int(d):02d}"
    return ""


# ---------------------------------------------------------------------------
# 점수 계산
# ---------------------------------------------------------------------------
def filename_hint_scores(filename: str, config: dict[str, Any]) -> dict[str, float]:
    name = squash(filename)
    hits = [key for key, spec in config["doc_types"].items()
            if any(squash(h) in name for h in spec.get("filename_hints", []))]
    if not hits:
        return {}
    # 파일명에 여러 종류가 섞여 있으면(예: 이력서_통장_신분증.pdf) 힌트 힘을 나눈다
    weight = 3.0 if len(hits) == 1 else 1.0
    return {key: weight for key in hits}


def score_text(text: str, config: dict[str, Any]) -> dict[str, float]:
    flat = squash(text)
    scores: dict[str, float] = {}
    for key, spec in config["doc_types"].items():
        total = 0.0
        for word, weight in spec.get("keywords", {}).items():
            count = flat.count(squash(word))
            if count:
                total += float(weight) * (1.5 if count >= 3 else 1.0)
        scores[key] = total
    length = len(flat)
    if "id" in scores and RRN_RE.search(text) and length < 600:
        scores["id"] += 2.0
    if "bank" in scores and find_accounts(text):
        scores["bank"] += 2.5
    if "resume" in scores and length > 1200:
        scores["resume"] += 1.5  # 글이 많은 페이지는 이력서일 가능성이 높다
    return scores


def classify_page(page: PageInfo, hints: dict[str, float], config: dict[str, Any]) -> None:
    scores = score_text(page.text, config)
    for key, value in hints.items():
        scores[key] = scores.get(key, 0.0) + value
    page.scores = {k: round(v, 1) for k, v in scores.items()}
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best_key, best = ranked[0] if ranked else (UNKNOWN, 0.0)
    second = ranked[1][1] if len(ranked) > 1 else 0.0
    if best < float(config["min_score"]):
        page.doc_type = UNKNOWN
        page.confidence = 0.0
        page.needs_review = True
        page.notes.append("분류 근거 부족" + (" (스캔 이미지·OCR 없음)" if page.image_only else ""))
        return
    page.doc_type = best_key
    page.confidence = round(best / (best + second + 1.0), 2)
    if second > 0 and best / second < float(config["review_margin"]):
        page.needs_review = True
        page.notes.append(f"다른 종류와 점수 비슷함({ranked[1][0]})")
    if page.image_only:
        page.needs_review = True
        page.notes.append("파일명만으로 분류(스캔 이미지)")


# ---------------------------------------------------------------------------
# 파일 단위 보정 + 문서 경계
# ---------------------------------------------------------------------------
def smooth_file_pages(pages: list[PageInfo]) -> None:
    """한 파일 안에서 앞뒤 문맥으로 미분류 페이지를 보정한다."""
    for i, page in enumerate(pages):
        if page.doc_type != UNKNOWN or i == 0:
            continue
        prev = pages[i - 1]
        nxt = pages[i + 1] if i + 1 < len(pages) else None
        # 이력서 다음 장(글이 있는 페이지)은 대개 이력서의 이어지는 장
        if prev.doc_type == "resume" and len(squash(page.text)) >= 80:
            page.doc_type = "resume"
            page.confidence = 0.4
            page.notes = [n for n in page.notes if not n.startswith("분류 근거 부족")]
            page.needs_review = any(page.notes)
            page.notes.append("앞 페이지(이력서)에 이어지는 장으로 판단")
            continue
        # 앞뒤가 같은 종류면 그 사이도 같은 종류로
        if nxt and prev.doc_type == nxt.doc_type and prev.doc_type != UNKNOWN:
            page.doc_type = prev.doc_type
            page.confidence = 0.3
            page.notes.append("앞뒤 페이지와 같은 종류로 판단")


def _has_title(page: PageInfo, spec: dict[str, Any]) -> bool:
    top = squash(page.top_text or page.text[:200])
    return any(squash(word) in top for word in spec.get("title_keywords", []))


def mark_boundaries(pages: list[PageInfo], config: dict[str, Any]) -> None:
    """각 페이지가 새 문서의 시작인지 판정한다. pages 는 한 파일의 페이지들."""
    prev: PageInfo | None = None
    for page in pages:
        accounts = find_accounts(page.text)
        page.account = accounts[0] if accounts else ""
        if prev is None or page.doc_type != prev.doc_type:
            page.start_new = True
        elif page.doc_type == UNKNOWN:
            page.start_new = False  # 미분류 연속 페이지는 한 묶음으로(검수 편의)
        else:
            spec = config["doc_types"][page.doc_type]
            mode = spec.get("split", "page")
            if mode == "title":
                page.start_new = _has_title(page, spec)
            elif mode == "account":
                page.start_new = not (page.account and page.account == prev.account)
            else:  # page
                back_words = [squash(w) for w in spec.get("back_keywords", [])]
                is_back = any(w in squash(page.text) for w in back_words)
                prev_back = any(w in squash(prev.text) for w in back_words)
                page.start_new = not (is_back and not prev_back)
            if page.start_new and page.doc_type == "resume":
                page.notes.append("이력서 제목이 다시 나타나 새 버전으로 분리")
        prev = page
