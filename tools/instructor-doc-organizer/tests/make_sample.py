"""exe 동작 확인용 샘플 폴더 생성: python tests/make_sample.py <폴더>"""

from __future__ import annotations

import sys
from pathlib import Path

import pymupdf
from PIL import Image

PAGES = [
    ["이 력 서", "인적사항 성명 홍길동", "학력사항 한국대학교 졸업", "경력사항 OO교육원 강사", "강의경력 다수"],
    ["통장사본", "KB국민은행", "계좌번호 123456-01-234567", "예금주 홍길동", "사용기간 2022.01 ~ 2023.12"],
    ["주민등록증", "홍길동", "800101-1******", "서울특별시 종로구청장"],
]


def main(root: Path) -> None:
    folder = root / "홍길동"
    folder.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open()
    for lines in PAGES:
        doc.new_page().insert_text((60, 80), "\n".join(lines), fontname="korea", fontsize=12)
    doc.save(folder / "서류 모음.pdf")
    Image.new("RGB", (800, 500), (220, 230, 240)).save(folder / "통장사본(농협).jpg")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
