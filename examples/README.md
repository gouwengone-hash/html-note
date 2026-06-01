# Examples

Generated HTML examples are intentionally not committed by default because they can be large, especially when source documents contain embedded images.

To create a local example:

```powershell
python ..\scripts\inject_annotations.py input.html -o input_noted.html
```

If `huashu-md-html` and `pandoc` are installed:

```powershell
python ..\scripts\inject_annotations.py input.md --from-md -o input_noted.html
```
