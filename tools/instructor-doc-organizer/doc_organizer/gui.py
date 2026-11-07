"""tkinter 화면 (추가 설치 불필요)."""

from __future__ import annotations

import os
import platform
import queue
import subprocess
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

from .config import load_config
from .pipeline import PAGE_REPORT, SUMMARY_REPORT, Pipeline, elapsed

OCR_CHOICES = {"자동": "auto", "Tesseract": "tesseract", "Windows 내장 OCR": "windows", "사용 안 함": "none"}


def open_path(path: Path) -> None:
    if platform.system() == "Windows":
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif platform.system() == "Darwin":
        subprocess.run(["open", str(path)], check=False)
    else:
        subprocess.run(["xdg-open", str(path)], check=False)


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("강사 서류 정리기 - PDF 변환 · 서류별 분할")
        self.geometry("860x640")
        self.minsize(720, 520)
        self.config_data = load_config()
        self.messages: queue.Queue[tuple[str, object]] = queue.Queue()
        self.cancel = threading.Event()
        self.worker: threading.Thread | None = None

        self.src_var = tk.StringVar()
        self.out_var = tk.StringVar()
        self.ocr_var = tk.StringVar(value=next(
            (k for k, v in OCR_CHOICES.items() if v == self.config_data.get("ocr_engine")), "자동"))
        self.a4_var = tk.BooleanVar(value=bool(self.config_data.get("image_fit_a4", True)))
        self.status_var = tk.StringVar(value="원본 폴더(강사 이름 폴더들이 들어 있는 폴더)를 선택하세요.")

        self._build()
        self.after(100, self._poll)

    # ------------------------------------------------------------------ 화면
    def _build(self) -> None:
        pad = {"padx": 8, "pady": 4}
        frm = ttk.Frame(self)
        frm.pack(fill="x", **pad)

        ttk.Label(frm, text="원본 폴더").grid(row=0, column=0, sticky="w")
        ttk.Entry(frm, textvariable=self.src_var).grid(row=0, column=1, sticky="ew", padx=4)
        ttk.Button(frm, text="찾아보기", command=self._pick_src).grid(row=0, column=2)

        ttk.Label(frm, text="통합 폴더").grid(row=1, column=0, sticky="w")
        ttk.Entry(frm, textvariable=self.out_var).grid(row=1, column=1, sticky="ew", padx=4)
        ttk.Button(frm, text="찾아보기", command=self._pick_out).grid(row=1, column=2)
        frm.columnconfigure(1, weight=1)

        opt = ttk.LabelFrame(self, text="옵션")
        opt.pack(fill="x", **pad)
        ttk.Label(opt, text="스캔본 글자 인식(OCR)").pack(side="left", padx=6)
        ttk.Combobox(opt, textvariable=self.ocr_var, values=list(OCR_CHOICES), state="readonly",
                     width=16).pack(side="left")
        ttk.Checkbutton(opt, text="사진/이미지는 A4 용지에 맞춤", variable=self.a4_var).pack(side="left", padx=12)

        btns = ttk.Frame(self)
        btns.pack(fill="x", **pad)
        self.run_btn = ttk.Button(btns, text="▶ 실행 (변환 + 분할)", command=self._run)
        self.run_btn.pack(side="left")
        self.rebuild_btn = ttk.Button(btns, text="↻ 보고서 수정 반영 재생성", command=self._rebuild)
        self.rebuild_btn.pack(side="left", padx=6)
        self.stop_btn = ttk.Button(btns, text="■ 중지", command=self.cancel.set, state="disabled")
        self.stop_btn.pack(side="left")
        ttk.Button(btns, text="통합 폴더 열기", command=self._open_out).pack(side="right")
        ttk.Button(btns, text="요약 보고서 열기", command=self._open_summary).pack(side="right", padx=6)

        self.progress = ttk.Progressbar(self, mode="determinate")
        self.progress.pack(fill="x", **pad)
        ttk.Label(self, textvariable=self.status_var).pack(fill="x", padx=8)

        self.log_box = ScrolledText(self, height=20, state="disabled", font=("Malgun Gothic", 9))
        self.log_box.pack(fill="both", expand=True, **pad)

        help_text = ("※ 원본 파일은 수정하지 않습니다. 결과는 통합 폴더에 강사별로 저장됩니다.  "
                     f"분류가 틀렸으면 '{PAGE_REPORT}'의 수정분류/수정문서시작 열을 고친 뒤 '재생성'을 누르세요.")
        ttk.Label(self, text=help_text, foreground="#555", wraplength=820).pack(fill="x", padx=8, pady=(0, 8))

    def _pick_src(self) -> None:
        path = filedialog.askdirectory(title="강사 폴더들이 들어 있는 원본 폴더 선택")
        if path:
            self.src_var.set(path)
            if not self.out_var.get():
                self.out_var.set(str(Pipeline.default_output(Path(path))))
            self.status_var.set("준비 완료. [실행]을 누르세요.")

    def _pick_out(self) -> None:
        path = filedialog.askdirectory(title="결과를 저장할 통합 폴더 선택")
        if path:
            self.out_var.set(path)

    def _open_out(self) -> None:
        out = Path(self.out_var.get())
        if out.exists():
            open_path(out)

    def _open_summary(self) -> None:
        report = Path(self.out_var.get()) / SUMMARY_REPORT
        if report.exists():
            open_path(report)
        else:
            messagebox.showinfo("안내", "아직 보고서가 없습니다.")

    # ------------------------------------------------------------------ 실행
    def _make_pipeline(self) -> Pipeline:
        config = load_config()
        config["ocr_engine"] = OCR_CHOICES[self.ocr_var.get()]
        config["image_fit_a4"] = self.a4_var.get()
        return Pipeline(
            config,
            log=lambda m: self.messages.put(("log", m)),
            progress=lambda i, n, label: self.messages.put(("progress", (i, n, label))),
            cancel=self.cancel,
        )

    def _start(self, target: object) -> None:
        self.cancel.clear()
        self._set_busy(True)
        self.worker = threading.Thread(target=target, daemon=True)
        self.worker.start()

    def _run(self) -> None:
        src = Path(self.src_var.get().strip())
        out_text = self.out_var.get().strip()
        out = Path(out_text) if out_text else Pipeline.default_output(src)
        self.out_var.set(str(out))
        try:
            Pipeline.validate_paths(src, out)
        except ValueError as exc:
            messagebox.showerror("폴더 확인", str(exc))
            return
        if (out / SUMMARY_REPORT).exists() and not messagebox.askyesno(
            "확인", "통합 폴더에 이전 결과가 있습니다.\n같은 이름의 강사 폴더 결과를 새로 만들까요?\n"
                   f"(수정해 둔 {PAGE_REPORT} 도 새로 만들어집니다)"):
            return

        def work() -> None:
            started = time.time()
            try:
                summary = self._make_pipeline().run(src, out)
                self.messages.put(("done", f"완료 ({elapsed(started)}) - 강사 {len(summary.instructors)}명"))
            except Exception as exc:  # noqa: BLE001
                self.messages.put(("error", str(exc)))

        self._start(work)

    def _rebuild(self) -> None:
        out = Path(self.out_var.get().strip())
        if not (out / PAGE_REPORT).exists():
            messagebox.showerror("안내", f"통합 폴더에 {PAGE_REPORT} 가 없습니다.")
            return

        def work() -> None:
            started = time.time()
            try:
                self._make_pipeline().rebuild(out)
                self.messages.put(("done", f"재생성 완료 ({elapsed(started)})"))
            except Exception as exc:  # noqa: BLE001
                self.messages.put(("error", str(exc)))

        self._start(work)

    def _set_busy(self, busy: bool) -> None:
        state = "disabled" if busy else "normal"
        self.run_btn.configure(state=state)
        self.rebuild_btn.configure(state=state)
        self.stop_btn.configure(state="normal" if busy else "disabled")

    def _append(self, line: str) -> None:
        self.log_box.configure(state="normal")
        self.log_box.insert("end", line + "\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _poll(self) -> None:
        try:
            while True:
                kind, payload = self.messages.get_nowait()
                if kind == "log":
                    self._append(str(payload))
                elif kind == "progress":
                    i, n, label = payload  # type: ignore[misc]
                    self.progress.configure(maximum=max(n, 1), value=i)
                    self.status_var.set(f"{i}/{n} 처리 중: {label}")
                elif kind == "done":
                    self._set_busy(False)
                    self.status_var.set(str(payload))
                    messagebox.showinfo("완료", f"{payload}\n\n요약 보고서에서 '검수필요' 항목을 확인하세요.")
                elif kind == "error":
                    self._set_busy(False)
                    self.status_var.set("오류")
                    messagebox.showerror("오류", str(payload))
        except queue.Empty:
            pass
        self.after(100, self._poll)


def main() -> None:
    App().mainloop()


if __name__ == "__main__":
    main()
