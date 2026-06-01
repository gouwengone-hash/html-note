---
name: html-note
description: Mark up local HTML reading pages with a theme-aware browser-local note layer, tags, side cards, TOC markers, drawing boards, and Markdown export. Use when the user wants to annotate or mark an HTML file, preserve the source HTML theme/layout, store notes locally, or export notes/marks to Markdown.
---

# html-note

Use this skill when the user wants to mark up an HTML file locally, store notes in the browser, and export marks/notes to Markdown:

- select text in the article and create a mark/note
- show a temporary dashed anchor while the note popover is open
- attach a right-side card to the selected passage with a dashed connector
- on wide article-style pages with enough whitespace on both sides, place cards on both left and right rails; prefer the right side, and keep cards with the same primary tag on the same side when possible
- add up to five custom colored tags, with fixed non-repeating theme colors
- rename existing tags by double-clicking them and sync old cards
- switch the note editor to a whiteboard with pen, line, arrow, rectangle, circle, triangle, eraser, undo, redo, and image paste/upload
- edit/copy/delete existing cards
- export marks as Markdown, optionally filtered by selected tags, including a file/rules/statistics preface, quoted source text, tag-numbered notes, and embedded whiteboard images
- show faint dashed anchors in the正文 and highlight them when hovering cards
- add same-color circular markers after matching TOC headings
- if a selected heading is not present in the TOC, attach the marker to the nearest preceding heading that is present in the TOC
- persist notes/tags/whiteboard drawings in browser `localStorage`

## Workflow

1. Generate the base HTML first, usually with `huashu-md-html` or another Markdown-to-HTML tool.
2. Run the injector:

```powershell
python scripts/inject_annotations.py "path\to\page.html"
```
If the user starts from Markdown and `huashu-md-html` is installed, the injector can render first and then inject notes:

```powershell
python scripts/inject_annotations.py "path\to\source.md" --from-md -o "path\to\source_noted.html"
```

This uses `huashu-md-html` with the `interactive` theme by default. Override with `--huashu-theme article|report|reading|interactive` when needed.

3. Reopen or refresh the HTML in the browser.
4. Verify:
   - selecting正文 opens the note popover near the selection
   - the note textarea receives focus immediately after the popover opens
   - selected正文 immediately shows a temporary faint dashed anchor
   - clicking blank page space closes an unfinished popover and removes the temporary anchor
   - selecting new正文 while the popover is open refreshes the temporary anchor
   - Enter in the note textarea saves the note, while Shift+Enter inserts a newline
   - creating more than five labels is blocked with a clear prompt
   - double-clicking an existing label renames it and updates old cards
   - TOC note dots are circular and split into color bands when one note has multiple tags
   - TOC note dots still appear when the nearest正文 heading is not included in the TOC, by falling back to the nearest preceding TOC heading
   - after several notes, a new popover has no stray dashed blank boxes before the textarea
   - completing a note creates a right-side card and a faint正文 anchor
   - connector lines are single horizontal dashed SVG lines from正文 to the card, not bent or slanted
   - connectors that start on the same正文 row are staggered downward by 2px increments
   - right-side cards default to the midpoint between the正文 right edge and the viewport right edge
   - on pages such as `huashu-md-html` `article` theme where both sides of the正文 have enough whitespace, cards can use both left and right side rails; the right side is preferred and the same primary tag stays on the same side when possible
   - vertically overlapping right-side cards shift slightly right by one quarter of the normal right margin per overlap depth, then reset when the overlap chain ends
   - selecting across paragraphs marks each text segment without moving or wrapping paragraph blocks
   - hover over a card deepens the card and highlights the正文 anchor
   - hovering a right-side card brings it to the top with only a slight movement, then restores it when the pointer leaves
   - Mune opens the export/clear menu, and clicking blank page space closes it
   - Mune defaults export filtering to the `疑问` tag when that tag exists
   - 导出MD starts with a short说明, HTML filename, export rules, and tag counts
   - 导出MD can export only notes matching the selected tag(s), including quoted正文, note text, tag-numbered notes, and whiteboard image Markdown
   - background toggles a faint tag-colored background on the marked正文 while preserving dashed underlines
   - 清空标记 asks for confirmation and removes all notes, right-side cards,正文 anchors, and whiteboard images
   - clicking 编辑 opens the full editor; double-clicking a card note edits only the note text inline
   - tools other than pen work on the whiteboard
   - notes survive page refresh

## Theme Structure Contracts

Treat html-note as a theme-aware interaction layer, not a brute-force page rewriter. Preserve the source HTML's layout contracts and insert only the managed html-note block near the end of `<body>`.

- Do not move, wrap, or reorder existing theme containers such as `header.title-block`, `nav#TOC`, `nav[role="doc-toc"]`, `main.document-body`, `article`, or theme-owned layout wrappers.
- For `huashu-md-html` `interactive`, the left sidebar TOC depends on this direct body structure:

```html
<body>
  <header class="title-block">...</header>
  <nav id="TOC" role="doc-toc">...</nav>
  <main class="document-body">...</main>
</body>
```

- After injecting `interactive` pages, verify `body > nav#TOC` still exists, `main.document-body` still owns the reading content, and the TOC renders as a fixed left sidebar at desktop width.
- Exclude `#TOC`, `nav[role="doc-toc"]`, and html-note UI from正文 selection, scanning, restoration, and exported quoted text unless the user explicitly selected TOC text.
- For `huashu-md-html` `article`, wide centered reading pages may use both left and right note rails when both sides have enough whitespace. Prefer the right side, and keep the same primary tag on the same side when possible.
- For `huashu-md-html` `report` and `reading`, preserve the original body width, tables, formulas, images, and reading rhythm; the note layer should add interaction without changing the document's visual hierarchy.

## Critical Behavior

The html-note UI and theme navigation must never be marked as正文. The script stores a cloned `Range` from the original正文 selection and uses only that range when the user clicks `完成`; it also excludes `.note-popover`, `.note-rail`, connectors, `#TOC`, and `nav[role="doc-toc"]` from text scanning/restoration. This prevents the common regression where repeated comments create blank dashed boxes inside the popover and push the textarea to the right.

Unfinished popovers use preview marks only. Preview marks are removed when the user clicks blank space or chooses a new selection, and are converted to permanent marks only after `完成`.

Tags use exactly five theme colors. New tags take the next unused color; after five tags the UI must refuse creation instead of reusing colors. Existing tag text can be changed by double-clicking a tag button, and saved note cards must update to the new text/color mapping.

## Output Contract

The injector edits the HTML file in place by default. It inserts one managed block near the end of `<body>` marked with:

- `<!-- html-note:start -->`
- `<!-- html-note:end -->`

Re-running the injector replaces the managed block instead of duplicating it.

Re-running the injector must not change parent/child relationships of theme-owned nodes such as `body > nav#TOC` or `main.document-body`.

## Notes

- This is a browser-local html-note layer, not a server database. Data is saved under a `localStorage` key scoped to `location.pathname`.
- For portable archival, export the browser localStorage separately or build a future exporter.
- Prefer the narrowest reading content root available: `main.document-body`, `article`, then `body`. Never treat theme chrome such as TOC/sidebar/header controls as the primary content root.






