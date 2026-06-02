---
name: html-note
description: Mark up local HTML reading pages with theme-aware browser-local note layers, tags, side cards, TOC markers, drawing boards, Markdown export, and portable single-file HTML export. Use when the user wants to annotate or mark an HTML file, preserve the source HTML theme/layout, store notes locally, manage multiple note layers, or export notes/marks to Markdown/HTML.
---

# html-note

Use this skill when the user wants to mark up an HTML file locally, store notes in the browser, manage multiple note layers, and export marks/notes to Markdown or a portable HTML copy:

- select text in the article and create a mark/note
- show a temporary dashed anchor while the note popover is open
- attach a right-side card to the selected passage with a dashed connector
- on wide article-style pages with enough whitespace on both sides, place cards on both left and right rails; prefer the right side, and keep cards with the same primary tag on the same side when possible
- add up to five custom colored tags, with fixed non-repeating theme colors
- rename existing tags by double-clicking them and sync old cards
- switch the note editor to a whiteboard with pen, line, arrow, rectangle, circle, triangle, eraser, undo, redo, and image paste/upload
- edit/copy/delete existing cards
- add a bottom-center `总记录` dock for whole-document questions, overall judgments, or AI follow-up prompts
- auto-expand the bottom-right menu on hover/focus with a springy pop-in animation, and auto-collapse it when the pointer leaves
- provide a `保存` button next to `总记录` that writes the current annotated HTML back to a user-authorized local file when the browser supports the File System Access API
- export marks as Markdown, optionally filtered by selected tags, including a file/rules/statistics preface, quoted source text, tag-numbered notes, and embedded whiteboard images
- create multiple note layers such as `note1` and `note2`, choose the active layer for new annotations, and show/hide layers independently
- export a single-file HTML copy with embedded annotation data and the `总记录` text so another browser or computer can restore the same note layers without the original `localStorage`
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
   - hovering or focusing the bottom-right menu expands hidden controls with a springy animation; moving the pointer away auto-collapses open panels without a click
   - hovering or focusing Mune opens an English export menu with the same translucent, springy visual style as 总记录; clicking blank page space closes it
   - Mune shows a `Groups` section; `new group` creates `note2`/custom groups, clicking the group name sets where new notes are saved, and group checkboxes show/hide matching cards,正文 anchors, connectors, TOC dots, and Markdown export items
   - Mune defaults export filtering to the `疑问` tag when that tag exists
   - 总记录 sits at the bottom center as a long semi-transparent dock; hovering/focusing it opens a wider textarea and focuses the input directly
   - 总记录 auto-saves local text on input without requiring Enter
   - 保存 next to 总记录 writes the current single-file HTML back to an authorized local HTML file; browsers can infer the displayed `file://` path but cannot overwrite it until the user grants write permission by choosing that HTML file once
   - 导出MD puts non-empty 总记录 content near the front of the Markdown before说明/statistics and individual annotation sections
   - 导出MD can export 总记录 alone even when there are no matching point annotations
   - Export MD starts with a short说明, HTML filename, export rules, and tag counts
   - Export MD can export only notes matching the selected tag(s), including quoted正文, note text, tag-numbered notes, and whiteboard image Markdown
   - Save as downloads a new single HTML file that preserves the original page, html-note UI, 总记录, tags, groups, annotations, and whiteboard images in an embedded JSON block
   - opening an exported HTML copy on another browser/computer restores embedded notes when no local notes exist for that file path; continuing to annotate still writes to that browser's localStorage until exporting another HTML copy
   - selecting across MathJax CHTML or native MathML formulas treats the formula as an atomic annotation target; no `mark` should be inserted inside `mjx-container`, `<math>`, `<semantics>`, `<mrow>`, `<mi>`, `<mo>`, `<mn>`, `<mtext>`, or `<annotation>`
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

Formula DOM is atomic. Protect both MathJax CHTML (`.math`, `.MathJax`, `.MJX-TEX`, `mjx-container`) and native MathML (`math`, `semantics`, `mrow`, `mi`, `mo`, `mn`, `mtext`, `annotation`) from text wrapping. If a selection intersects a formula, mark the nearest formula container as a whole block/inline formula and include its TeX/MathML text in the quote/export; never insert `mark.annotation-phrase` inside formula internals.

Tags use exactly five theme colors. New tags take the next unused color; after five tags the UI must refuse creation instead of reusing colors. Existing tag text can be changed by double-clicking a tag button, and saved note cards must update to the new text/color mapping.

Note layers are metadata around the existing annotation records. Legacy single-layer annotations must migrate into `note1`. New annotations are assigned to the active layer. Hiding a layer should remove its正文 anchors/cards/connectors/TOC dots from the view without deleting the data, and showing it should restore marks from saved anchors.

## Output Contract

The injector edits the HTML file in place by default. It inserts one managed block near the end of `<body>` marked with:

- `<!-- html-note:start -->`
- `<!-- html-note:end -->`

Re-running the injector replaces the managed block instead of duplicating it.

Re-running the injector must not change parent/child relationships of theme-owned nodes such as `body > nav#TOC` or `main.document-body`.

The portable HTML exporter writes annotation data into a hidden JSON script with:

- `id="html-note-embedded-data"`
- `type="application/json"`

Do not remove the managed html-note UI/scripts when exporting; strip only runtime marks/connectors/cards and let the script restore visible layers when the exported file is opened.

## Notes

- This is a browser-local html-note layer system, not a server database. Data is saved under `localStorage` keys scoped to `location.pathname`.
- For portable archival/sharing, use 另存为. The exported copy is still a single HTML file, but later edits in another browser stay local until that user saves or exports another copy.
- Direct local overwrite through 保存 depends on browser file-write permission. The first save may ask the user to choose the current HTML file; after permission is granted, later saves can overwrite that authorized file.
- `总记录` is separate from point annotations. Clearing visible annotations should not erase the whole-document record unless the user edits that textarea directly.
- Prefer the narrowest reading content root available: `main.document-body`, `article`, then `body`. Never treat theme chrome such as TOC/sidebar/header controls as the primary content root.






