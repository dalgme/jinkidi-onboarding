"""실행 파일(.exe) 진입점.

인자 없이 실행(더블클릭) → 화면(GUI)
인자와 함께 실행 → 명령줄 모드 (예: 강사서류정리기.exe "D:\\강사서류" --ocr none)
"""

import sys

from doc_organizer.cli import main

sys.exit(main())
