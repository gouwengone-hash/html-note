#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
START = "<!-- html-note:start -->"
END = "<!-- html-note:end -->"
LEGACY_START = "<!-- anchored-html-annotations:start -->"
LEGACY_END = "<!-- anchored-html-annotations:end -->"


def read_asset(name: str) -> str:
    return (ASSETS / name).read_text(encoding="utf-8")


def build_block() -> str:
    css = read_asset("annotations.css")
    html = read_asset("annotations.html")
    js = read_asset("annotations.js")
    return f"""{START}
<style>
{css}
</style>
{html}
<script>
{js}
</script>
{END}"""


def replace_managed_block(html: str, start: str, end: str, block: str) -> str | None:
    if start not in html or end not in html:
        return None
    before, rest = html.split(start, 1)
    _, after = rest.split(end, 1)
    return before.rstrip() + "\n" + block + "\n" + after.lstrip()


def inject(html: str, block: str) -> str:
    replaced = replace_managed_block(html, START, END, block)
    if replaced is not None:
        return replaced
    replaced = replace_managed_block(html, LEGACY_START, LEGACY_END, block)
    if replaced is not None:
        return replaced
    if "</body>" not in html:
        raise ValueError("HTML does not contain </body>; cannot inject html-note safely.")
    return html.replace("</body>", block + "\n</body>", 1)


def find_huashu_md_to_html() -> Path | None:
    candidates = [
        ROOT.parent / "huashu-md-html" / "scripts" / "md_to_html.py",
        Path.home() / ".agents" / "skills" / "huashu-md-html" / "scripts" / "md_to_html.py",
        Path.home() / ".codex" / "skills" / "huashu-md-html" / "scripts" / "md_to_html.py",
    ]
    return next((path for path in candidates if path.exists()), None)


def render_markdown_with_huashu(src: Path, out: Path, theme: str, extra_args: list[str]) -> None:
    renderer = find_huashu_md_to_html()
    if not renderer:
        raise SystemExit(
            "huashu-md-html is not installed. Install it first, or pass an existing HTML file without --from-md."
        )
    cmd = [sys.executable, str(renderer), str(src), "-o", str(out), "--theme", theme, *extra_args]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as error:
        raise SystemExit(
            f"huashu-md-html failed while rendering Markdown. Check its dependencies, especially pandoc. Exit code: {error.returncode}"
        ) from error


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Inject html-note into an HTML file, optionally rendering Markdown with huashu-md-html first.",
    )
    parser.add_argument("input", help="HTML file to modify, or Markdown file when --from-md is set.")
    parser.add_argument("-o", "--output", help="Write to a different output path instead of editing in place.")
    parser.add_argument("--from-md", action="store_true", help="Treat input as Markdown, render it with huashu-md-html, then inject html-note.")
    parser.add_argument("--renderer", choices=("huashu",), default="huashu", help="Markdown renderer to use with --from-md (default: huashu).")
    parser.add_argument("--huashu-theme", default="interactive", help="huashu-md-html theme for --from-md (default: interactive).")
    parser.add_argument("--huashu-arg", action="append", default=[], help="Extra argument passed through to huashu-md-html; repeat for multiple args.")
    args = parser.parse_args()

    src = Path(args.input).resolve()
    if not src.exists():
        raise SystemExit(f"input not found: {src}")

    out = Path(args.output).resolve() if args.output else src
    if args.from_md:
        if not args.output:
            out = src.with_name(f"{src.stem}_noted.html").resolve()
        temp_html = out.with_name(f"{out.stem}.__huashu_tmp__.html")
        try:
            render_markdown_with_huashu(src, temp_html, args.huashu_theme, args.huashu_arg)
            html = temp_html.read_text(encoding="utf-8")
            updated = inject(html, build_block())
            out.write_text(updated, encoding="utf-8")
        finally:
            temp_html.unlink(missing_ok=True)
        print(f"[ok] rendered Markdown with huashu-md-html and injected html-note -> {out}")
        return 0

    html = src.read_text(encoding="utf-8")
    updated = inject(html, build_block())
    out.write_text(updated, encoding="utf-8")
    print(f"[ok] injected html-note -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
