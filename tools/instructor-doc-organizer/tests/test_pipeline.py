from __future__ import annotations

import csv
import hashlib
import shutil
import subprocess
import zipfile
from pathlib import Path

import pymupdf
import pytest
from PIL import Image

from doc_organizer.classifier import extract_period, extract_written_date, find_accounts, find_bank
from doc_organizer.config import load_config
from doc_organizer.converter import find_soffice
from doc_organizer.naming import build_filename, sanitize
from doc_organizer.pipeline import DOC_REPORT, PAGE_REPORT, SUMMARY_REPORT, Pipeline

RESUME_1 = ["이 력 서", "", "인적사항  성명 홍길동  생년월일 1980.01.01", "학력사항  한국대학교 교육학 전공 졸업",
            "경력사항  2015~2020 OO교육원 강사", "강의경력  리더십, 커뮤니케이션 출강 다수"]
RESUME_1_P2 = ["주요 강의 내용 및 기관 목록입니다. " * 3, "2021 OO공사 신입사원 교육 / 2022 OO시청 공무원 교육",
               "2023 OO대학교 특강 / 2024 OO기업 임원 코칭", "저서: 소통의 기술 (2019)"]
RESUME_2 = ["강사 프로필", "", "성명 홍길동", "최종학력 한국대학원 박사", "주요경력 2020~현재 OO연구소 대표",
            "자격사항 직업능력개발훈련교사", "위와 같이 상기 내용이 사실임을 확인합니다.", "2024년 3월 5일"]
BANK_1 = ["통장사본", "KB국민은행", "계좌번호 123456-01-234567", "예금주 홍길동", "사용기간 2022.01 ~ 2023.12"]
BANK_2 = ["보통예금 통장", "신한은행", "계좌번호 110-123-456789", "예금주 홍길동", "2024.01~현재 사용"]
ID_CARD = ["주민등록증", "홍길동(洪吉童)", "800101-1******", "서울특별시 종로구 세종대로 1", "2015. 3. 2.", "서울특별시 종로구청장"]


def add_page(doc: pymupdf.Document, lines: list[str]) -> None:
    page = doc.new_page()
    page.insert_text((60, 80), "\n".join(lines), fontname="korea", fontsize=12, lineheight=1.6)


def make_pdf(path: Path, pages: list[list[str]]) -> None:
    doc = pymupdf.open()
    for lines in pages:
        add_page(doc, lines)
    doc.save(path)
    doc.close()


def make_hwpx(path: Path, lines: list[str]) -> None:
    ns = "http://www.hancom.co.kr/hwpml/2011/paragraph"
    paras = "".join(f'<hp:p><hp:run><hp:t>{line}</hp:t></hp:run></hp:p>' for line in lines)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="x" xmlns:hp="{ns}">{paras}</hs:sec>'
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("mimetype", "application/hwp+zip")
        zf.writestr("Contents/section0.xml", xml)


def sha_tree(root: Path) -> dict[str, str]:
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob("*")) if p.is_file()}


@pytest.fixture()
def config() -> dict:
    cfg = load_config()
    cfg["ocr_engine"] = "none"
    cfg["use_hancom"] = False
    cfg["use_ms_office"] = False
    return cfg


@pytest.fixture()
def source(tmp_path: Path) -> Path:
    root = tmp_path / "강사서류"
    hong = root / "홍길동"
    hong.mkdir(parents=True)
    make_pdf(hong / "홍길동 서류 모음.pdf", [RESUME_1, RESUME_1_P2, RESUME_2, BANK_1, BANK_2, ID_CARD])
    Image.new("RGB", (1200, 800), (200, 220, 240)).save(hong / "통장사본(농협 2019~2021).jpg")
    shutil.copy(hong / "통장사본(농협 2019~2021).jpg", hong / "복사본.jpg")  # 완전 중복
    (hong / "Thumbs.db").write_bytes(b"x")
    (hong / "메모.zip").write_bytes(b"PK")
    make_hwpx(hong / "강의 이력서.hwpx", RESUME_1)

    kim = root / "김철수"
    (kim / "하위폴더").mkdir(parents=True)
    Image.new("RGBA", (500, 320), (255, 0, 0, 128)).save(kim / "하위폴더" / "신분증.png")
    Image.new("P", (300, 300)).save(kim / "프로필.gif")
    return root


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig") as fp:
        return list(csv.DictReader(fp))


def test_full_run(source: Path, config: dict) -> None:
    before = sha_tree(source)
    summary = Pipeline(config, log=lambda _m: None).run(source)
    out = source.parent / "강사서류_통합"
    assert summary.output_root == out
    assert sha_tree(source) == before, "원본이 변경되면 안 된다"

    hong = sorted(p.name for p in (out / "홍길동").iterdir())
    assert hong == [
        "홍길동_신분증사본_01.pdf",
        "홍길동_이력서_01.pdf",                       # 강의 이력서.hwpx
        "홍길동_이력서_02.pdf",                       # 서류 모음 p1-2 (2쪽짜리 이력서)
        "홍길동_이력서_03_2024.03.05.pdf",            # 서류 모음 p3 (두 번째 버전)
        "홍길동_통장사본_01_농협은행_2019-2021.pdf",  # 파일명의 은행/기간
        "홍길동_통장사본_02_KB국민은행_2022.01-2023.12.pdf",
        "홍길동_통장사본_03_신한은행_2024.01-현재.pdf",
    ], hong
    assert pymupdf.open(out / "홍길동" / "홍길동_이력서_02.pdf").page_count == 2
    assert pymupdf.open(out / "홍길동" / "홍길동_이력서_03_2024.03.05.pdf").page_count == 1

    kim = sorted(p.name for p in (out / "김철수").iterdir())
    assert kim == ["김철수_신분증사본_01.pdf", "김철수_이력서_01.pdf"], kim

    rows = {r["강사"]: r for r in read_csv(out / SUMMARY_REPORT)}
    assert rows["홍길동"]["이력서"] == "3"
    assert rows["홍길동"]["통장사본"] == "3"
    assert rows["홍길동"]["누락서류"] == ""
    assert rows["김철수"]["누락서류"] == "통장사본"
    assert "중복" in rows["홍길동"]["실패/건너뜀 상세"]
    assert "지원하지 않는 형식" in rows["홍길동"]["실패/건너뜀 상세"]

    docs = read_csv(out / DOC_REPORT)
    hwpx_doc = next(d for d in docs if "강의 이력서.hwpx" in d["원본파일"])
    assert hwpx_doc["검수필요"] == "Y"  # 텍스트 추출 대체 변환
    jpg_doc = next(d for d in docs if "농협" in d["출력파일"])
    assert jpg_doc["검수필요"] == "Y"  # 스캔 이미지 + OCR 없음 → 파일명 기준


def test_rebuild_applies_manual_fix(source: Path, config: dict) -> None:
    pipeline = Pipeline(config, log=lambda _m: None)
    pipeline.run(source)
    out = source.parent / "강사서류_통합"
    rows = read_csv(out / PAGE_REPORT)
    for row in rows:
        if row["강사"] == "김철수" and row["원본파일"].endswith("프로필.gif"):
            row["수정분류"] = "제외"
        if row["강사"] == "홍길동" and row["원본파일"].endswith("서류 모음.pdf") and row["페이지"] == "3":
            row["수정문서시작"] = "N"  # 두 번째 이력서를 첫 번째와 합치기
    with (out / PAGE_REPORT).open("w", encoding="utf-8-sig", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    Pipeline(config, log=lambda _m: None).rebuild(out)
    assert sorted(p.name for p in (out / "김철수").iterdir()) == ["김철수_신분증사본_01.pdf"]
    resumes = sorted(p.name for p in (out / "홍길동").iterdir() if "이력서" in p.name)
    assert len(resumes) == 2
    assert pymupdf.open(out / "홍길동" / resumes[1]).page_count == 3  # p1~p3 합쳐짐
    # 수정값이 보고서에 유지되어 재생성을 반복해도 결과가 같다
    again = read_csv(out / PAGE_REPORT)
    assert any(r["수정분류"] == "제외" for r in again)


def test_output_inside_source_is_rejected(source: Path) -> None:
    with pytest.raises(ValueError):
        Pipeline.validate_paths(source, source)
    with pytest.raises(ValueError):
        Pipeline.validate_paths(source, source / "홍길동" / "결과")
    with pytest.raises(ValueError):
        Pipeline.validate_paths(source, source.parent)


@pytest.mark.skipif(find_soffice({"soffice_path": ""}) is None, reason="LibreOffice 없음")
def test_office_conversion(tmp_path: Path, config: dict) -> None:
    root = tmp_path / "src"
    teacher = root / "이영희"
    teacher.mkdir(parents=True)
    html = tmp_path / "resume.html"
    html.write_text("<html><body><h1>이력서</h1><p>학력사항 OO대학교 졸업</p><p>경력사항 OO학원 강사</p>"
                    "<p>강의경력 다수</p></body></html>", encoding="utf-8")
    subprocess.run(["soffice", "--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir",
                    str(tmp_path), str(html)], capture_output=True, timeout=120, check=False)
    docx = tmp_path / "resume.docx"
    if not docx.exists():
        pytest.skip("docx 샘플 생성 실패")
    shutil.copy(docx, teacher / "이영희.docx")
    Pipeline(config, log=lambda _m: None).run(root)
    assert [p.name for p in (tmp_path / "src_통합" / "이영희").iterdir()] == ["이영희_이력서_01.pdf"]


def test_helpers(config: dict) -> None:
    assert find_accounts("연락처 010-1234-5678, 02-123-4567") == []
    assert find_accounts("계좌 110-123-456789") == ["110-123-456789"]
    assert find_bank("NH농협 통장") == "농협은행"
    assert extract_period("", "통장(2019.3~2021.12)") == "2019.03-2021.12"
    assert extract_period("이 계좌는 2023년 1월 ~ 현재 사용 중", "") == "2023.01-현재"
    assert extract_period("거래일 2021.01.01 ~ 2021.02.01", "") == ""  # '사용' 근처가 아니면 무시
    assert extract_written_date("", "이력서_20230105") == "2023.01.05"
    assert sanitize('a/b:c*?"<>|') == "a_b_c"
    assert build_filename(config, name="홍길동", doctype="통장사본", seq=1, extras=["", "2022-2023"]) \
        == "홍길동_통장사본_01_2022-2023.pdf"
    config["filename_pattern"] = "{doctype}-{name}-{seq}"
    assert build_filename(config, name="홍길동", doctype="이력서", seq=3) == "이력서-홍길동-3.pdf"
