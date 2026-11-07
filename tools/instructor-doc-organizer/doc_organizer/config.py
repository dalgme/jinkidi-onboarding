"""기본 설정값.

같은 폴더(또는 실행 파일 옆)에 config.json 을 두면 아래 값 중 원하는 항목만 덮어쓸 수 있다.
예) {"filename_pattern": "{name}_{doctype}_{seq:02d}{extra}", "ocr_engine": "none"}
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# 서류 종류 정의
#   key      : 내부 식별자
#   label    : 파일명/보고서에 쓰이는 한글 이름
#   keywords : 페이지 본문에서 찾을 단어와 가중치
#   filename_hints : 원본 파일명에 들어 있으면 가산점을 주는 단어
#   split    : 같은 종류가 연속될 때 문서를 나누는 방식
#              "title"  → 제목(이력서 등)이 페이지 상단에 다시 나오면 새 문서
#              "page"   → 기본적으로 한 페이지 = 한 문서 (뒷면 신호가 있으면 이어 붙임)
#              "account"→ 계좌번호/은행이 바뀌면 새 문서 (없으면 페이지마다 새 문서)
# ---------------------------------------------------------------------------
BANK_NAMES = [
    "KB국민은행", "국민은행", "신한은행", "우리은행", "하나은행", "KEB하나", "NH농협", "농협은행", "농협",
    "IBK기업은행", "기업은행", "카카오뱅크", "토스뱅크", "케이뱅크", "새마을금고", "신협", "우체국",
    "SC제일은행", "제일은행", "씨티은행", "한국씨티", "대구은행", "iM뱅크", "부산은행", "경남은행",
    "광주은행", "전북은행", "제주은행", "수협", "산업은행", "저축은행",
]

DEFAULT_CONFIG: dict[str, Any] = {
    # 파일명 패턴. 사용 가능한 값:
    #   {name} 강사명, {doctype} 서류종류, {seq} 순번(정수), {extra} "_비고1_비고2" 형태(없으면 빈 문자열)
    #   {bank} 은행명, {period} 사용기간, {date} 작성일, {today} 처리일(YYYYMMDD)
    "filename_pattern": "{name}_{doctype}_{seq:02d}{extra}",
    # 통장사본 파일명에 은행명/사용기간을 붙일지
    "bank_extra_fields": ["bank", "period"],
    # 이력서 파일명에 작성일(감지된 경우)을 붙일지 → 버전이 여러 개일 때 구분용
    "resume_extra_fields": ["date"],
    # 분류가 애매한 페이지에 붙는 이름
    "unknown_label": "미분류",
    # 분류 최소 점수(이보다 낮으면 미분류)
    "min_score": 3.0,
    # 1등과 2등 점수 비율이 이보다 작으면 '검수필요' 표시
    "review_margin": 1.5,
    # OCR: auto | tesseract | windows | none
    "ocr_engine": "auto",
    "tesseract_cmd": "",
    "tesseract_lang": "kor+eng",
    "ocr_dpi": 200,
    # 본문 텍스트가 이 글자 수 미만이면 스캔 이미지로 보고 OCR 시도
    "ocr_min_chars": 30,
    # 이미지 → PDF 변환 시 A4 용지에 맞춰 배치할지 (False 면 원본 크기 페이지)
    "image_fit_a4": True,
    "image_max_px": 2480,
    "image_jpeg_quality": 85,
    # LibreOffice 실행 파일 경로(비워두면 자동 탐색)
    "soffice_path": "",
    # Windows 에서 MS Office / 한컴오피스 COM 자동화 사용 여부
    "use_ms_office": True,
    "use_hancom": True,
    "convert_timeout_sec": 180,
    # 무시할 파일
    "ignore_names": ["thumbs.db", "desktop.ini", ".ds_store"],
    "ignore_prefixes": ["~$", ".~lock", "._"],
    "doc_types": {
        "resume": {
            "label": "이력서",
            "split": "title",
            "keywords": {
                "이력서": 6, "履歷書": 6, "resume": 5, "curriculum vitae": 6, "경력기술서": 4,
                "강사 프로필": 5, "강사프로필": 5, "프로필": 2, "약력": 3,
                "인적사항": 4, "인적 사항": 4, "학력사항": 3, "학력 사항": 3, "학력": 2,
                "경력사항": 3, "경력 사항": 3, "주요경력": 3, "주요 경력": 3, "경력": 1.5,
                "강의경력": 4, "강의 경력": 4, "강의이력": 4, "강의 이력": 4, "출강": 2,
                "자격사항": 3, "자격증": 1.5, "자격 사항": 3, "수상": 1, "저서": 1.5,
                "자기소개": 2, "전공": 1, "졸업": 1, "최종학력": 3, "생년월일": 1, "연락처": 1,
                "e-mail": 0.5, "이메일": 0.5, "휴대폰": 0.5, "위와 같이": 1, "상기": 0.5,
            },
            "title_keywords": ["이력서", "履歷書", "resume", "curriculum vitae", "강사 프로필",
                               "강사프로필", "경력기술서", "인적사항", "인적 사항", "프로필"],
            "filename_hints": ["이력서", "이력", "경력", "프로필", "약력", "resume", "cv", "profile"],
        },
        "bank": {
            "label": "통장사본",
            "split": "account",
            "keywords": {
                "통장사본": 7, "통장 사본": 7, "통장": 4, "계좌번호": 4, "계좌 번호": 4, "예금주": 4,
                "보통예금": 3, "저축예금": 3, "입출금": 2, "자유입출금": 3, "예금": 1, "계좌": 2,
                "거래내역": 2, "통장번호": 3, "신규일": 2, "개설일": 2, "개설점": 2, "취급점": 2,
                "account no": 3, "bank": 1,
                **{name: 3 for name in BANK_NAMES},
            },
            "back_keywords": [],
            "filename_hints": ["통장", "계좌", "bank", "account", "예금"],
        },
        "id": {
            "label": "신분증사본",
            "split": "page",
            "keywords": {
                "신분증": 6, "주민등록증": 7, "운전면허증": 7, "자동차운전면허": 6, "운전면허": 4,
                "외국인등록증": 7, "여권": 4, "passport": 6, "republic of korea": 2,
                "장애인등록증": 5, "청소년증": 5, "모바일 신분증": 6,
                "경찰청장": 4, "지방경찰청장": 5, "시도경찰청장": 5, "적성검사": 4, "갱신기간": 3,
                "면허번호": 3, "발급일": 1, "구청장": 2, "시장": 0.5, "군수": 1, "동장": 1,
                "주민등록번호": 1,
            },
            "back_keywords": ["적성검사", "갱신기간", "주소변경", "뒷면", "후면", "재발급"],
            "filename_hints": ["신분증", "주민등록", "주민증", "운전면허", "면허증", "여권", "idcard",
                               "id_card", "id카드", "passport"],
        },
    },
}


def app_dir() -> Path:
    """실행 파일(또는 스크립트)이 있는 폴더."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def load_config(path: Path | None = None) -> dict[str, Any]:
    config = copy.deepcopy(DEFAULT_CONFIG)
    candidate = path or (app_dir() / "config.json")
    if candidate.is_file():
        with candidate.open("r", encoding="utf-8") as fp:
            _deep_merge(config, json.load(fp))
    return config


def label_to_key(config: dict[str, Any]) -> dict[str, str]:
    """'이력서' → 'resume' 역매핑 (보고서 수정분류 해석용)."""
    mapping = {spec["label"]: key for key, spec in config["doc_types"].items()}
    mapping[config["unknown_label"]] = "unknown"
    return mapping
