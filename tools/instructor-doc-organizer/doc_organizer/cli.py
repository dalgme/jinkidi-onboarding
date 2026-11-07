"""명령줄 실행.

  python -m doc_organizer "D:\\강사서류"                  # 기본: D:\\강사서류_통합 에 저장
  python -m doc_organizer "D:\\강사서류" -o "D:\\결과"
  python -m doc_organizer --rebuild "D:\\강사서류_통합"   # 페이지분류.csv 수정 반영
  python -m doc_organizer --gui                            # 화면 실행
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from .config import load_config
from .pipeline import Pipeline, elapsed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="doc_organizer", description="강사 서류 PDF 변환 · 서류별 분할")
    parser.add_argument("source", nargs="?", help="강사 이름 폴더들이 들어 있는 원본 폴더")
    parser.add_argument("-o", "--output", help="통합 폴더 (기본: <원본폴더>_통합)")
    parser.add_argument("--ocr", choices=["auto", "tesseract", "windows", "none"], help="OCR 엔진")
    parser.add_argument("--config", help="config.json 경로")
    parser.add_argument("--rebuild", metavar="통합폴더", help="페이지분류.csv 수정 내용을 반영해 다시 만들기")
    parser.add_argument("--gui", action="store_true", help="화면으로 실행")
    args = parser.parse_args(argv)

    if args.gui or (not args.source and not args.rebuild):
        from .gui import main as gui_main

        gui_main()
        return 0

    config = load_config(Path(args.config) if args.config else None)
    if args.ocr:
        config["ocr_engine"] = args.ocr
    pipeline = Pipeline(config, log=print)
    started = time.time()
    try:
        if args.rebuild:
            pipeline.rebuild(Path(args.rebuild))
        else:
            pipeline.run(Path(args.source), Path(args.output) if args.output else None)
    except ValueError as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 2
    print(f"소요 시간: {elapsed(started)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
