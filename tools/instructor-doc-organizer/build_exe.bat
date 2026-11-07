@echo off
chcp 65001 > nul
REM 1) 가상환경 + 패키지 설치
if not exist .venv (py -3 -m venv .venv)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
REM 2) 실행 파일(.exe) 만들기 → dist\강사서류정리기.exe
pyinstaller --noconfirm --onefile --windowed --name 강사서류정리기 --collect-all pymupdf --hidden-import win32com.client --hidden-import pythoncom run.pyw
copy /Y config.example.json dist\config.example.json > nul
echo.
echo 완료: dist\강사서류정리기.exe
pause
