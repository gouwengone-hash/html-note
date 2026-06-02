(() => {
  const main = document.querySelector("main.document-body, main, article, .document-body, .content, body");
  const rail = document.getElementById("annotation-rail");
  const leftRail = document.getElementById("annotation-rail-left");
  const exportBox = document.getElementById("annotation-export");
  const exportOpen = document.getElementById("annotation-export-open");
  const exportPanel = document.getElementById("annotation-export-panel");
  const exportClose = document.getElementById("annotation-export-close");
  const exportTags = document.getElementById("annotation-export-tags");
  const exportAll = document.getElementById("annotation-export-all");
  const exportClear = document.getElementById("annotation-export-clear");
  const clearTags = document.getElementById("annotation-clear-tags");
  const layerList = document.getElementById("annotation-layer-list");
  const layerAdd = document.getElementById("annotation-layer-add");
  const exportHtml = document.getElementById("annotation-export-html");
  const bodyBackgroundToggle = document.getElementById("annotation-body-background-toggle");
  const exportDownload = document.getElementById("annotation-export-download");
  const pop = document.getElementById("annotation-popover");
  const excerptEl = document.getElementById("annotation-excerpt");
  const noteInput = document.getElementById("annotation-text");
  const tagInput = document.getElementById("annotation-tag-input");
  const tagCreate = document.getElementById("annotation-tag-create");
  const tagConfirm = document.getElementById("annotation-tag-confirm");
  const tagList = document.getElementById("annotation-tag-list");
  const done = document.getElementById("annotation-done");
  const close = document.getElementById("annotation-close");
  const copy = document.getElementById("annotation-copy");
  const toggleBoard = document.getElementById("annotation-toggle-board");
  const board = document.getElementById("annotation-board");
  const boardColor = document.getElementById("board-color");
  const boardSize = document.getElementById("board-size");
  const boardFile = document.getElementById("board-file");
  const pasteImage = document.getElementById("board-paste-image");
  const undo = document.getElementById("board-undo");
  const redo = document.getElementById("board-redo");
  if (!main || !rail || !exportBox || !exportOpen || !exportPanel || !pop || !board) return;

  const rails = [leftRail, rail].filter(Boolean);

  const pageId = location.pathname.replace(/[^\w.-]+/g, "-") || "page";
  const storeKey = `huashu-anchored-annotations:v1:${pageId}`;
  const tagKey = `huashu-anchored-annotation-tags:v1:${pageId}`;
  const layerKey = `huashu-anchored-annotation-layers:v1:${pageId}`;
  const backgroundKey = `huashu-anchored-annotation-background:v1:${pageId}`;
  const embeddedDataId = "html-note-embedded-data";
  const defaultLayerId = "layer-note1";
  const palette = ["#15803d", "#d97706", "#2563eb", "#db2777", "#7c3aed"];
  const mathSelector = ".math, .MathJax, .MJX-TEX, mjx-container, math";
  const blockSelector = "p,li,blockquote,figure,table,pre,.math.display,math[display='block'],h1,h2,h3,h4,h5,h6";
  const anchorSelector = "[data-annotation-id]";

  const embeddedData = loadEmbeddedData();
  let annotations = loadJson(storeKey, embeddedData?.annotations || []);
  let tags = normalizeTags(loadJson(tagKey, embeddedData?.tags || [
    { name: "疑问", color: palette[0] },
    { name: "灵感", color: palette[1] },
    { name: "重点", color: palette[2] },
  ]));
  let layerState = normalizeLayerState(loadJson(layerKey, embeddedData?.layers || null));
  annotations = annotations.map(syncAnnotationTags).map(syncAnnotationLayer);
  let activeSelection = null;
  let activeRange = null;
  let selectionPreviewId = null;
  let editingId = null;
  let selectedTags = new Set();
  let boardMode = false;
  let selectionTimer = 0;
  let suppressSelection = false;
  const cardLowerTimers = new Map();
  let cardZIndex = 80;
  let bodyBackgroundOn = loadJson(backgroundKey, false) === true;

  const ctx = board.getContext("2d");
  let tool = "pen";
  let drawing = false;
  let start = null;
  let snapshot = null;
  let undoStack = [];
  let redoStack = [];

  captureOriginalMathSources();

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function loadEmbeddedData() {
    try {
      const node = document.getElementById(embeddedDataId);
      return node?.textContent ? JSON.parse(node.textContent) : null;
    } catch {
      return null;
    }
  }

  function saveAll() {
    localStorage.setItem(storeKey, JSON.stringify(annotations));
    localStorage.setItem(tagKey, JSON.stringify(tags));
    localStorage.setItem(layerKey, JSON.stringify(layerState));
  }

  function saveBodyBackground() {
    localStorage.setItem(backgroundKey, JSON.stringify(bodyBackgroundOn));
  }

  function defaultExportTagNames() {
    return tags.some((tag) => tag.name === "疑问") ? ["疑问"] : [];
  }

  function normalizeTags(value) {
    const result = [];
    const seen = new Set();
    const fixed = new Map([
      ["疑问", palette[0]],
      ["灵感", palette[1]],
      ["重点", palette[2]],
    ]);
    (Array.isArray(value) ? value : []).forEach((tag) => {
      const name = String(tag?.name || tag || "").trim();
      if (!name || seen.has(name) || result.length >= palette.length) return;
      seen.add(name);
      result.push({ name, color: fixed.get(name) || palette[result.length] });
    });
    if (result.length) return result;
    return [
      { name: "疑问", color: palette[0] },
      { name: "灵感", color: palette[1] },
      { name: "重点", color: palette[2] },
    ];
  }

  function tagByName(name) {
    return tags.find((tag) => tag.name === name);
  }

  function normalizeLayerState(value) {
    const sourceLayers = Array.isArray(value?.items) ? value.items : Array.isArray(value) ? value : [];
    const items = [];
    const seen = new Set();
    sourceLayers.forEach((layer, index) => {
      const id = String(layer?.id || `layer-${Date.now()}-${index}`).trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      items.push({
        id,
        name: String(layer?.name || `note${index + 1}`).trim() || `note${index + 1}`,
        visible: layer?.visible !== false,
      });
    });
    if (!items.length) items.push({ id: defaultLayerId, name: "note1", visible: true });
    const activeId = items.some((layer) => layer.id === value?.activeId)
      ? value.activeId
      : items[0].id;
    return { activeId, items };
  }

  function layerById(id) {
    return layerState.items.find((layer) => layer.id === id);
  }

  function activeLayer() {
    return layerById(layerState.activeId) || layerState.items[0];
  }

  function isLayerVisible(id) {
    return layerById(id)?.visible !== false;
  }

  function visibleAnnotations() {
    return annotations.filter((annotation) => isLayerVisible(annotation.layerId));
  }

  function nextLayerName() {
    let index = layerState.items.length + 1;
    const names = new Set(layerState.items.map((layer) => layer.name));
    while (names.has(`note${index}`)) index += 1;
    return `note${index}`;
  }

  function setActiveLayer(id) {
    if (!layerById(id)) return;
    layerState.activeId = id;
    if (!isLayerVisible(id)) layerById(id).visible = true;
    saveAll();
    renderLayerList();
    refreshAnnotationVisibility();
  }

  function refreshAnnotationVisibility() {
    annotations.forEach((annotation) => {
      if (!isLayerVisible(annotation.layerId)) unwrapAnnotation(annotation.id);
    });
    restoreSelectionMarks();
    syncAnnotationMarks();
    renderAnnotations();
  }

  function renderLayerList() {
    if (!layerList) return;
    layerList.innerHTML = "";
    layerState.items.forEach((layer) => {
      const row = document.createElement("div");
      row.className = "annotation-layer-item";
      const label = document.createElement("label");
      const visible = document.createElement("input");
      visible.type = "checkbox";
      visible.checked = layer.visible !== false;
      visible.dataset.layerVisible = layer.id;
      const name = document.createElement("span");
      name.className = "annotation-layer-name";
      name.textContent = `${layer.name} (${annotations.filter((annotation) => annotation.layerId === layer.id).length})`;
      label.append(visible, name);
      const actions = document.createElement("div");
      actions.className = "annotation-layer-actions";
      const current = document.createElement("button");
      current.type = "button";
      current.dataset.layerCurrent = layer.id;
      current.className = layer.id === activeLayer().id ? "annotation-layer-current" : "";
      current.textContent = layer.id === activeLayer().id ? "当前" : "设为当前";
      const rename = document.createElement("button");
      rename.type = "button";
      rename.dataset.layerRename = layer.id;
      rename.textContent = "重命名";
      actions.append(current, rename);
      row.append(label, actions);
      layerList.appendChild(row);
    });
  }

  function syncAnnotationTags(annotation) {
    const synced = (annotation.tags || [])
      .map((tag) => tagByName(tag?.name || tag))
      .filter(Boolean);
    return { ...annotation, tags: synced };
  }

  function syncAnnotationLayer(annotation) {
    const layerId = layerById(annotation.layerId)?.id || defaultLayerId;
    if (!layerById(layerId)) layerState.items.unshift({ id: layerId, name: "note1", visible: true });
    return { ...annotation, layerId };
  }

  function captureOriginalMathSources() {
    main.querySelectorAll(".math.inline,.math.display,math").forEach((element) => {
      if (element.dataset.htmlNoteMathSource) return;
      const source = mathSourceForElement(element);
      if (source.trim()) element.dataset.htmlNoteMathSource = source;
    });
  }

  function mathSourceForElement(element) {
    const direct = element.querySelector?.("annotation[encoding='application/x-tex'],annotation")?.textContent || element.textContent || "";
    if (direct.trim()) return direct;
    try {
      const mathItem = window.MathJax?.startup?.document?.math?.find((item) => element.contains(item.typesetRoot) || item.start?.node === element);
      const tex = mathItem?.math || "";
      if (tex) return element.classList.contains("display") ? `\\[${tex}\\]` : `\\(${tex}\\)`;
    } catch {
      // Keep export resilient when MathJax internals are unavailable.
    }
    return "";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function escapeMarkdown(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim();
  }

  function markdownQuote(value) {
    const text = escapeMarkdown(value);
    return text ? text.split("\n").map((line) => `> ${line}`).join("\n") : "> ";
  }

  function pageTitle() {
    return (document.querySelector("h1")?.textContent || document.title || "批注导出").trim();
  }

  function exportFileName() {
    const base = pageTitle().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80) || "annotations";
    return `${base}-批注.md`;
  }

  function exportHtmlFileName() {
    const base = htmlFileName().replace(/\.html?$/i, "").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 100) || "html-note";
    return `${base}-with-notes.html`;
  }

  function pageY(rect) {
    return rect.top + window.scrollY;
  }

  function trimmed(text, n = 96) {
    const compact = String(text || "").replace(/\s+/g, " ").trim();
    return compact.length > n ? `${compact.slice(0, n)}...` : compact;
  }

  function currentBoardBackground() {
    const color = getComputedStyle(board).backgroundColor;
    return color && color !== "rgba(0, 0, 0, 0)" ? color : "#fbfaf6";
  }

  function clearBoard() {
    ctx.clearRect(0, 0, board.width, board.height);
    ctx.fillStyle = currentBoardBackground();
    ctx.fillRect(0, 0, board.width, board.height);
    undoStack = [board.toDataURL("image/png")];
    redoStack = [];
  }

  function restoreBoard(dataUrl) {
    clearBoard();
    if (!dataUrl) return;
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, board.width, board.height);
      undoStack = [board.toDataURL("image/png")];
      redoStack = [];
    };
    image.src = dataUrl;
  }

  function loadCanvasState(dataUrl) {
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, board.width, board.height);
      ctx.fillStyle = currentBoardBackground();
      ctx.fillRect(0, 0, board.width, board.height);
      ctx.drawImage(image, 0, 0, board.width, board.height);
    };
    image.src = dataUrl;
  }

  function pushUndo() {
    undoStack.push(board.toDataURL("image/png"));
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  }

  function restoreSnapshot(imageData) {
    if (imageData) ctx.putImageData(imageData, 0, 0);
  }

  function canvasPoint(event) {
    const rect = board.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (board.width / rect.width),
      y: (event.clientY - rect.top) * (board.height / rect.height),
    };
  }

  function drawLine(a, b, styleTool = tool) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Number(boardSize.value);
    ctx.strokeStyle = styleTool === "eraser" ? currentBoardBackground() : boardColor.value;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (styleTool === "arrow") {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const length = 14 + Number(boardSize.value);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - length * Math.cos(angle - Math.PI / 6), b.y - length * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(b.x - length * Math.cos(angle + Math.PI / 6), b.y - length * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShape(a, b) {
    if (tool === "line" || tool === "arrow") {
      drawLine(a, b, tool);
      return;
    }
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Number(boardSize.value);
    ctx.strokeStyle = boardColor.value;
    ctx.fillStyle = boardColor.value;
    if (tool === "rect") ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    if (tool === "circle") {
      const rx = Math.abs(b.x - a.x) / 2;
      const ry = Math.abs(b.y - a.y) / 2;
      ctx.beginPath();
      ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (tool === "triangle") {
      ctx.beginPath();
      ctx.moveTo((a.x + b.x) / 2, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(a.x, b.y);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderTags() {
    tagList.innerHTML = "";
    tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-choice";
      btn.textContent = tag.name;
      btn.style.background = tag.color;
      btn.title = "双击修改标签";
      btn.setAttribute("aria-pressed", String(selectedTags.has(tag.name)));
      btn.addEventListener("click", () => {
        if (selectedTags.has(tag.name)) selectedTags.delete(tag.name);
        else selectedTags.add(tag.name);
        renderTags();
      });
      btn.addEventListener("dblclick", (event) => {
        event.preventDefault();
        renameTag(tag.name);
      });
      tagList.appendChild(btn);
    });
    const add = document.createElement("button");
    add.type = "button";
    add.className = "icon-button";
    add.id = "annotation-add-tag";
    add.title = "添加标签";
    add.setAttribute("aria-label", "添加标签");
    add.textContent = "+";
    add.addEventListener("click", () => {
      tagCreate.hidden = !tagCreate.hidden;
      if (!tagCreate.hidden) tagInput.focus();
    });
    tagList.appendChild(add);
  }

  function addCurrentTag() {
    const name = tagInput.value.trim();
    if (!name) {
      tagInput.focus();
      return;
    }
    if (!tags.some((tag) => tag.name === name)) {
      if (tags.length >= palette.length) {
        window.alert("最多只能建立 5 个标签。");
        return;
      }
      tags.push({ name, color: palette[tags.length] });
    }
    selectedTags.add(name);
    tagInput.value = "";
    tagCreate.hidden = true;
    saveAll();
    renderTags();
    renderExportTags();
  }

  function selectedTagObjects() {
    return Array.from(selectedTags).map((name) => tagByName(name)).filter(Boolean);
  }

  function defaultSelectedTags() {
    return tags[2]?.name ? new Set([tags[2].name]) : new Set();
  }

  function renameTag(oldName) {
    const tag = tagByName(oldName);
    if (!tag) return;
    const nextName = window.prompt("修改标签文本", oldName);
    if (nextName === null) return;
    const name = nextName.trim();
    if (!name || name === oldName) return;
    if (tags.some((item) => item.name === name)) {
      window.alert("已经存在同名标签。");
      return;
    }
    tag.name = name;
    if (selectedTags.delete(oldName)) selectedTags.add(name);
    annotations = annotations.map((annotation) => ({
      ...annotation,
      tags: (annotation.tags || []).map((item) => item.name === oldName ? { ...tag } : item),
      updatedAt: annotation.updatedAt || new Date().toISOString(),
    }));
    saveAll();
    renderTags();
    renderExportTags();
    renderAnnotations();
  }

  function closestBlock(node) {
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return element?.closest?.(blockSelector);
  }

  function elementForNode(node) {
    return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  }

  function isAnnotationUiNode(node) {
    return !!elementForNode(node)?.closest?.(".annotation-rail,.annotation-popover,.annotation-export,.annotation-connector");
  }

  function isTocNode(node) {
    return !!elementForNode(node)?.closest?.("#TOC, nav[role='doc-toc'], nav.toc, .toc");
  }

  function validStoredRange(range) {
    return !!range && main.contains(range.commonAncestorContainer) && !isAnnotationUiNode(range.commonAncestorContainer) && !isTocNode(range.commonAncestorContainer);
  }

  function isIgnoredAnchorTextNode(node) {
    return !node.nodeValue || !!node.parentElement?.closest?.(`script,style,${mathSelector},.annotation-rail,.annotation-popover,.annotation-export,#TOC,nav[role='doc-toc'],nav.toc,.toc`);
  }

  function mathContainersInRange(range) {
    const containers = new Set();
    main.querySelectorAll(mathSelector).forEach((element) => {
      try {
        if (range.intersectsNode(element)) containers.add(element);
      } catch {
        // Ignore detached or non-intersectable nodes.
      }
    });
    return Array.from(containers).filter((element, index, all) => {
      if (element.closest?.(".annotation-popover,.annotation-rail,.annotation-export")) return false;
      return !all.some((other, otherIndex) => otherIndex !== index && other.contains(element));
    });
  }

  function mathIdsFromRange(range) {
    return mathContainersInRange(range).map((element) => ensureMathId(element)).filter(Boolean);
  }

  function ensureMathId(element) {
    if (element.id) return element.id;
    element.id = `html-note-math-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return element.id;
  }

  function mathTextForElement(element) {
    const source = element.querySelector?.("annotation")?.textContent || element.textContent || "";
    return compactText(source);
  }

  function mathElementIndex(element) {
    return Array.from(main.querySelectorAll(mathSelector)).indexOf(element);
  }

  function orderedSelectionParts(range) {
    const parts = rangeTextSlices(range).map(({ node, start, end }) => ({
      type: "text",
      top: node.parentElement?.getBoundingClientRect?.().top || 0,
      left: node.parentElement?.getBoundingClientRect?.().left || 0,
      text: node.nodeValue.slice(start, end),
    }));
    mathContainersInRange(range).forEach((element) => {
      const rect = element.getBoundingClientRect();
      parts.push({
        type: "math",
        top: rect.top,
        left: rect.left,
        text: mathTextForElement(element),
      });
    });
    return parts
      .filter((part) => compactText(part.text))
      .sort((a, b) => a.top - b.top || a.left - b.left);
  }

  function quoteTextFromRange(range) {
    return orderedSelectionParts(range).map((part) => part.text).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function textAnchorSnapshot() {
    const nodes = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isIgnoredAnchorTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return { nodes, text: nodes.map((item) => item.nodeValue || "").join("") };
  }

  function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function textAnchorForRange(range) {
    if (!validStoredRange(range)) return null;
    const snapshot = textAnchorSnapshot();
    let offset = 0;
    let start = null;
    let end = null;
    snapshot.nodes.forEach((node) => {
      const value = node.nodeValue || "";
      const length = value.length;
      let intersects = false;
      try {
        intersects = range.intersectsNode(node);
      } catch {
        intersects = false;
      }
      if (intersects) {
        const sliceStart = node === range.startContainer ? range.startOffset : 0;
        const sliceEnd = node === range.endContainer ? range.endOffset : length;
        if (sliceEnd > sliceStart) {
          if (start === null) start = offset + sliceStart;
          end = offset + sliceEnd;
        }
      }
      offset += length;
    });
    if (start === null || end === null || end <= start) return null;
    const context = 48;
    return {
      start,
      end,
      quote: snapshot.text.slice(start, end),
      prefix: snapshot.text.slice(Math.max(0, start - context), start),
      suffix: snapshot.text.slice(end, end + context),
    };
  }

  function textAnchorForSlice(node, start, end) {
    const snapshot = textAnchorSnapshot();
    let offset = 0;
    for (const item of snapshot.nodes) {
      const length = (item.nodeValue || "").length;
      if (item === node) {
        const safeStart = Math.max(0, Math.min(length, start));
        const safeEnd = Math.max(safeStart, Math.min(length, end));
        if (safeEnd <= safeStart) return null;
        const anchorStart = offset + safeStart;
        const anchorEnd = offset + safeEnd;
        const context = 48;
        return {
          start: anchorStart,
          end: anchorEnd,
          quote: snapshot.text.slice(anchorStart, anchorEnd),
          prefix: snapshot.text.slice(Math.max(0, anchorStart - context), anchorStart),
          suffix: snapshot.text.slice(anchorEnd, anchorEnd + context),
        };
      }
      offset += length;
    }
    return null;
  }

  function selectionPartsFromRange(range) {
    if (!validStoredRange(range)) return [];
    const parts = rangeTextSlices(range).map(({ node, start, end }) => ({
      type: "text",
      anchor: textAnchorForSlice(node, start, end),
      text: node.nodeValue.slice(start, end),
      top: node.parentElement?.getBoundingClientRect?.().top || 0,
      left: node.parentElement?.getBoundingClientRect?.().left || 0,
    }));
    mathContainersInRange(range).forEach((element) => {
      const rect = element.getBoundingClientRect();
      parts.push({
        type: "math",
        id: ensureMathId(element),
        text: mathTextForElement(element),
        index: mathElementIndex(element),
        top: rect.top,
        left: rect.left,
      });
    });
    return parts
      .filter((part) => compactText(part.text) && (part.type === "math" ? part.id : part.anchor))
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .map((part) => {
        if (part.type === "math") return { type: "math", id: part.id, text: part.text, index: part.index };
        return { type: "text", anchor: part.anchor, text: part.text };
      });
  }

  function rangeFromTextOffsets(snapshot, start, end) {
    const range = document.createRange();
    let offset = 0;
    let started = false;
    let ended = false;
    for (const node of snapshot.nodes) {
      const length = (node.nodeValue || "").length;
      const nextOffset = offset + length;
      if (!started && start >= offset && start <= nextOffset) {
        range.setStart(node, Math.max(0, Math.min(length, start - offset)));
        started = true;
      }
      if (started && end >= offset && end <= nextOffset) {
        range.setEnd(node, Math.max(0, Math.min(length, end - offset)));
        ended = true;
        break;
      }
      offset = nextOffset;
    }
    return started && ended ? range : null;
  }

  function textAnchorScore(anchor, snapshot, start, end) {
    const quote = String(anchor?.quote || "");
    const actual = snapshot.text.slice(start, end);
    if (!quote || compactText(actual) !== compactText(quote)) return -1;
    let score = actual === quote ? 4 : 2;
    if (anchor.prefix && snapshot.text.slice(Math.max(0, start - anchor.prefix.length), start) === anchor.prefix) score += 1;
    if (anchor.suffix && snapshot.text.slice(end, end + anchor.suffix.length) === anchor.suffix) score += 1;
    return score;
  }

  function rangeForTextAnchor(annotation) {
    const anchor = annotation.anchor;
    if (!anchor || typeof anchor.start !== "number" || typeof anchor.end !== "number") return null;
    const snapshot = textAnchorSnapshot();
    if (anchor.end <= anchor.start || anchor.start < 0 || anchor.end > snapshot.text.length) return null;
    const directScore = textAnchorScore(anchor, snapshot, anchor.start, anchor.end);
    if (directScore >= 2) return rangeFromTextOffsets(snapshot, anchor.start, anchor.end);

    const quote = String(anchor.quote || "");
    if (!quote) return null;
    let best = null;
    let bestScore = -1;
    let index = snapshot.text.indexOf(quote);
    while (index !== -1) {
      const end = index + quote.length;
      const score = textAnchorScore(anchor, snapshot, index, end);
      if (score > bestScore) {
        bestScore = score;
        best = { start: index, end };
      }
      index = snapshot.text.indexOf(quote, index + 1);
    }
    return best ? rangeFromTextOffsets(snapshot, best.start, best.end) : null;
  }

  function mathElementForPart(part) {
    if (part?.id) {
      const element = document.getElementById(part.id);
      if (element?.matches?.(mathSelector)) return element;
    }
    const text = compactText(part?.text);
    if (!text) return null;
    const elements = Array.from(main.querySelectorAll(mathSelector));
    if (Number.isInteger(part?.index)) {
      const indexed = elements[part.index];
      if (indexed && compactText(mathTextForElement(indexed)) === text) return indexed;
    }
    return elements.find((element) => compactText(mathTextForElement(element)) === text) || null;
  }

  function markMathElement(element, annotation) {
    if (!element || isAnnotationUiNode(element) || isTocNode(element)) return false;
    if (!element.matches?.(mathSelector)) return false;
    element.dataset.annotationId = annotation.id;
    element.classList.add("annotation-block");
    setMarkColors(element, annotation);
    return true;
  }

  function withSuppressedSelection(callback) {
    suppressSelection = true;
    try {
      callback();
    } finally {
      window.setTimeout(() => {
        suppressSelection = false;
      }, 0);
    }
  }

  function rangeMeta(range) {
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    const first = rects[0] || range.getBoundingClientRect();
    const all = range.getBoundingClientRect();
    const block = closestBlock(range.commonAncestorContainer);
    const text = quoteTextFromRange(range) || range.toString();
    const blockTag = block?.tagName || "";
    return {
      id: `ann-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      top: pageY(first),
      left: all.left + window.scrollX,
      right: all.right + window.scrollX,
      height: all.height || first.height || 20,
      blocky: ["FIGURE", "TABLE", "PRE"].includes(blockTag) || block?.classList?.contains("math"),
      anchor: textAnchorForRange(range),
      mathIds: mathIdsFromRange(range),
      parts: selectionPartsFromRange(range),
    };
  }

  function anchorRect(annotation) {
    const marks = Array.from(document.querySelectorAll(`[data-annotation-id="${CSS.escape(annotation.id)}"]`));
    const rects = marks.flatMap((mark) => Array.from(mark.getClientRects())).filter((rect) => rect.width > 0 && rect.height > 0);
    if (!rects.length) {
      return {
        top: annotation.top,
        left: annotation.left,
        right: annotation.right,
        height: annotation.height || 20,
      };
    }
    const top = Math.min(...rects.map((rect) => rect.top + window.scrollY));
    const left = Math.min(...rects.map((rect) => rect.left + window.scrollX));
    const right = Math.max(...rects.map((rect) => rect.right + window.scrollX));
    const bottom = Math.max(...rects.map((rect) => rect.bottom + window.scrollY));
    return { top, left, right, height: Math.max(1, bottom - top) };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function placePopover(preferredLeft, preferredTop) {
    const margin = 16;
    pop.dataset.open = "true";
    pop.style.visibility = "hidden";
    pop.style.left = "0px";
    pop.style.top = "0px";
    const rect = pop.getBoundingClientRect();
    const width = rect.width || Math.min(460, window.innerWidth - margin * 2);
    const height = Math.min(rect.height || 320, window.innerHeight - margin * 2);
    const minLeft = window.scrollX + margin;
    const maxLeft = window.scrollX + Math.max(margin, window.innerWidth - width - margin);
    const minTop = window.scrollY + margin;
    const maxTop = window.scrollY + Math.max(margin, window.innerHeight - height - margin);
    pop.style.left = `${clamp(preferredLeft, minLeft, maxLeft)}px`;
    pop.style.top = `${clamp(preferredTop, minTop, maxTop)}px`;
    pop.style.visibility = "";
  }

  function openPopover(meta, range) {
    clearSelectionPreview();
    activeSelection = meta;
    activeRange = range?.cloneRange?.() || null;
    activeSelection.segments = validStoredRange(activeRange) ? segmentTextsFromRange(activeRange.cloneRange()) : [];
    selectionPreviewId = meta.id;
    editingId = null;
    selectedTags = defaultSelectedTags();
    noteInput.value = "";
    tagInput.value = "";
    tagCreate.hidden = true;
    boardMode = false;
    pop.dataset.board = "false";
    toggleBoard.title = "进入画板";
    toggleBoard.setAttribute("aria-label", "进入画板");
    excerptEl.textContent = trimmed(meta.text, 72) || "选区批注";
    renderTags();
    clearBoard();
    const mainRect = contentRect();
    const top = meta.top - 24;
    const left = mainRect.right + window.scrollX + 28;
    placePopover(left, top);
    addSelectionPreview(meta);
    noteInput.focus();
  }

  function openEditor(annotation) {
    clearSelectionPreview();
    activeRange = null;
    const rect = anchorRect(annotation);
    activeSelection = {
      id: annotation.id,
      text: annotation.text,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      height: rect.height,
      blocky: annotation.blocky,
    };
    editingId = annotation.id;
    selectedTags = new Set((annotation.tags || []).map((tag) => tag.name));
    noteInput.value = annotation.note || "";
    tagInput.value = "";
    tagCreate.hidden = true;
    boardMode = !!annotation.board;
    pop.dataset.board = String(boardMode);
    toggleBoard.title = boardMode ? "回到文本" : "进入画板";
    toggleBoard.setAttribute("aria-label", boardMode ? "回到文本" : "进入画板");
    excerptEl.textContent = trimmed(annotation.text, 72) || "编辑批注";
    renderTags();
    restoreBoard(annotation.board || "");
    const card = cardForAnnotation(annotation.id);
    const railRect = (card?.closest(".annotation-rail") || rail).getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    const top = window.scrollY + Math.max(24, (cardRect?.top || railRect.top) - 8);
    const left = railRect.left + window.scrollX - 10;
    placePopover(left, top);
    setEditingMark(annotation.id, true);
    noteInput.focus();
  }

  function closePopover() {
    if (activeSelection?.id) setEditingMark(activeSelection.id, false);
    if (!editingId) clearSelectionPreview();
    pop.dataset.open = "false";
    activeSelection = null;
    activeRange = null;
    selectionPreviewId = null;
    editingId = null;
    withSuppressedSelection(() => window.getSelection()?.removeAllRanges());
  }

  function setEditingMark(id, on) {
    document.querySelectorAll(`[data-annotation-id="${CSS.escape(id)}"]`).forEach((mark) => {
      mark.classList.toggle("annotation-editing", on);
    });
  }

  function primaryTagColor(annotation) {
    return annotation.tags?.[0]?.color || "var(--color-accent, #2c5e3f)";
  }

  function hexToRgba(hex, alpha) {
    const match = String(hex || "").trim().match(/^#?([0-9a-f]{6})$/i);
    if (!match) return `rgba(44, 94, 63, ${alpha})`;
    const value = match[1];
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function setMarkColors(mark, annotation) {
    const color = primaryTagColor(annotation);
    mark.style.setProperty("--annotation-mark-color", color);
    mark.style.setProperty("--annotation-mark-background", hexToRgba(color, annotation.blocky ? 0.09 : 0.12));
  }

  function syncAnnotationMarks() {
    document.body.dataset.annotationBodyBackground = String(bodyBackgroundOn);
    if (bodyBackgroundToggle) bodyBackgroundToggle.setAttribute("aria-pressed", String(bodyBackgroundOn));
    visibleAnnotations().forEach((annotation) => {
      document.querySelectorAll(`[data-annotation-id="${CSS.escape(annotation.id)}"]`).forEach((mark) => {
        setMarkColors(mark, annotation);
      });
    });
  }

  function cardForAnnotation(id) {
    return rails
      .map((item) => item.querySelector(`[data-id="${CSS.escape(id)}"]`))
      .find(Boolean) || null;
  }

  function primaryTagName(annotation) {
    return annotation.tags?.[0]?.name || "";
  }

  function makeCard(annotation, top) {
    const card = document.createElement("article");
    card.className = "annotation-card";
    card.dataset.id = annotation.id;
    card.style.top = `${top}px`;
    card.style.borderLeftColor = primaryTagColor(annotation);
    card.style.borderRightColor = primaryTagColor(annotation);
    const tagsHtml = (annotation.tags || []).map((tag) => `<span class="annotation-tag" style="background:${escapeHtml(tag.color)}">${escapeHtml(tag.name)}</span>`).join("");
    const boardHtml = annotation.board ? `<img class="annotation-thumb" src="${annotation.board}" alt="白板批注">` : "";
    const noteHtml = annotation.note
      ? `<p class="card-note" data-quick-edit="${escapeHtml(annotation.id)}" title="双击快速编辑">${escapeHtml(annotation.note)}</p>`
      : `<p class="card-note card-note-empty" data-quick-edit="${escapeHtml(annotation.id)}" title="双击快速编辑">双击添加批注</p>`;
    card.innerHTML = `
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ""}
      ${noteHtml}
      ${boardHtml}
      <div class="card-actions">
        <button type="button" data-edit="${escapeHtml(annotation.id)}">编辑</button>
        <button type="button" data-copy="${escapeHtml(annotation.id)}">复制</button>
        <button type="button" data-delete="${escapeHtml(annotation.id)}">删除</button>
      </div>
    `;
    card.addEventListener("pointerenter", () => raiseCard(card, true));
    card.addEventListener("pointerleave", () => scheduleLowerCard(card));
    return card;
  }

  function raiseCard(card, on) {
    if (!card?.dataset?.id) return;
    const timer = cardLowerTimers.get(card.dataset.id);
    if (timer) {
      window.clearTimeout(timer);
      cardLowerTimers.delete(card.dataset.id);
    }
    if (on) {
      if (!card.classList.contains("annotation-raised")) {
        cardZIndex += 1;
        card.style.zIndex = String(cardZIndex);
      }
    } else {
      card.style.removeProperty("z-index");
    }
    card.classList.toggle("annotation-raised", on);
    highlightAnnotation(card.dataset.id, on);
  }

  function scheduleLowerCard(card) {
    if (!card?.dataset?.id) return;
    const id = card.dataset.id;
    const existing = cardLowerTimers.get(id);
    if (existing) window.clearTimeout(existing);
    cardLowerTimers.set(id, window.setTimeout(() => {
      cardLowerTimers.delete(id);
      if (card.matches(":hover") || card.contains(document.activeElement)) return;
      raiseCard(card, false);
    }, 150));
  }

  function raiseAnnotation(id, on) {
    if (!id) return;
    const card = cardForAnnotation(id);
    if (card) {
      raiseCard(card, on);
      return;
    }
    highlightAnnotation(id, on);
  }

  function contentRect() {
    const candidates = Array.from(main.querySelectorAll("p,li,blockquote,figure,table,pre,h1,h2,h3,h4,h5,h6,.math.display,math[display='block']"))
      .filter((node) => !isAnnotationUiNode(node) && !isTocNode(node));
    const rects = candidates
      .map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0 && rect.width < window.innerWidth * 0.86);
    if (!rects.length) return main.getBoundingClientRect();
    return {
      left: Math.min(...rects.map((rect) => rect.left)),
      right: Math.max(...rects.map((rect) => rect.right)),
      top: Math.min(...rects.map((rect) => rect.top)),
      bottom: Math.max(...rects.map((rect) => rect.bottom)),
      width: 0,
      height: 0,
    };
  }

  function availableRails() {
    const mainRect = contentRect();
    const railWidth = rail.offsetWidth || leftRail?.offsetWidth || 380;
    const gap = 24;
    const edgeMargin = 12;
    const viewportLeft = window.scrollX;
    const viewportRight = window.scrollX + window.innerWidth;
    const enoughSpace = railWidth + gap + edgeMargin;
    const leftSpace = mainRect.left - edgeMargin;
    const rightSpace = window.innerWidth - mainRect.right - edgeMargin;
    const rightMin = mainRect.right + window.scrollX + gap;
    const rightMax = viewportRight - railWidth - edgeMargin;
    const leftMin = viewportLeft + edgeMargin;
    const leftMax = mainRect.left + window.scrollX - gap - railWidth;
    const rightLeft = rightMax >= rightMin
      ? rightMin + (rightMax - rightMin) / 2
      : Math.min(rightMin, rightMax);
    const leftLeft = leftMax >= leftMin
      ? leftMin + (leftMax - leftMin) / 2
      : Math.max(leftMin, leftMax);
    const result = {
      mainRect,
      right: {
        side: "right",
        rail,
        left: Math.max(viewportLeft + edgeMargin, rightLeft),
        space: rightSpace,
        enabled: rightSpace >= enoughSpace || !leftRail,
      },
      left: {
        side: "left",
        rail: leftRail,
        left: Math.max(viewportLeft + edgeMargin, leftLeft),
        space: leftSpace,
        enabled: !!leftRail && leftSpace >= enoughSpace,
      },
    };
    if (!result.right.enabled && !result.left.enabled) result.right.enabled = true;
    return result;
  }

  function assignAnnotationSides(items, layout) {
    const tagSides = new Map();
    let rightCount = 0;
    let leftCount = 0;
    return items.map((annotation) => {
      let side = "right";
      const tagName = primaryTagName(annotation);
      if (layout.left.enabled && layout.right.enabled) {
        if (tagName && tagSides.has(tagName)) {
          side = tagSides.get(tagName);
        } else if (rightCount <= leftCount) {
          side = "right";
        } else {
          side = "left";
        }
        if (tagName) tagSides.set(tagName, side);
      } else if (layout.left.enabled && !layout.right.enabled) {
        side = "left";
      }
      if (side === "left") leftCount += 1;
      else rightCount += 1;
      return { annotation, side };
    });
  }

  function quickEditNote(node, annotation) {
    if (!node || node.dataset.editing === "true") return;
    node.dataset.editing = "true";
    const editor = document.createElement("textarea");
    editor.className = "card-note-editor";
    editor.value = annotation.note || "";
    editor.rows = Math.max(2, Math.min(8, editor.value.split("\n").length + 1));
    node.replaceWith(editor);
    editor.focus();
    editor.select();
    const finish = (save) => {
      if (!editor.isConnected) return;
      if (save) {
        annotation.note = editor.value.trim();
        annotation.updatedAt = new Date().toISOString();
        saveAll();
      }
      renderAnnotations();
    };
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        finish(true);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    editor.addEventListener("blur", () => finish(true));
  }

  function commitPopover() {
    if (!activeSelection) return;
    const selection = window.getSelection();
    const boardData = boardMode ? board.toDataURL("image/png") : "";
    if (editingId) {
      const annotation = annotations.find((item) => item.id === editingId);
      if (!annotation) return;
      annotation.note = noteInput.value.trim();
      annotation.tags = selectedTagObjects();
      annotation.board = boardData;
      annotation.anchor = annotation.anchor || textAnchorForRange(rangeFromExistingMarks(annotation.id));
      annotation.updatedAt = new Date().toISOString();
      setEditingMark(annotation.id, false);
    } else {
      const annotation = {
        id: activeSelection.id,
        text: activeSelection.text,
        top: activeSelection.top,
        left: activeSelection.left,
        right: activeSelection.right,
        height: activeSelection.height,
        blocky: activeSelection.blocky,
        segments: validStoredRange(activeRange) ? segmentTextsFromRange(activeRange.cloneRange()) : (activeSelection.segments || []),
        anchor: validStoredRange(activeRange) ? textAnchorForRange(activeRange.cloneRange()) : activeSelection.anchor,
        mathIds: validStoredRange(activeRange) ? mathIdsFromRange(activeRange.cloneRange()) : (activeSelection.mathIds || []),
        parts: activeSelection.parts || (validStoredRange(activeRange) ? selectionPartsFromRange(activeRange.cloneRange()) : []),
        layerId: activeLayer().id,
        note: noteInput.value.trim(),
        tags: selectedTagObjects(),
        board: boardData,
        createdAt: new Date().toISOString(),
      };
      annotations.push(annotation);
      addSelectionMark(annotation);
      selectionPreviewId = null;
    }
    saveAll();
    withSuppressedSelection(() => selection?.removeAllRanges());
    closePopover();
    renderAnnotations();
  }

  function clearAllAnnotations() {
    const visible = visibleAnnotations();
    if (!visible.length) {
      window.alert("当前没有批注。");
      return;
    }
    if (!window.confirm("确定清空当前可见图层的批注吗？隐藏图层中的批注会保留。")) return;
    const visibleIds = new Set(visible.map((annotation) => annotation.id));
    visible.forEach((annotation) => unwrapAnnotation(annotation.id));
    annotations = annotations.filter((annotation) => !visibleIds.has(annotation.id));
    selectedTags.clear();
    closePopover();
    saveAll();
    renderTags();
    renderExportTags();
    renderAnnotations();
  }

  function renderAnnotations() {
    cardLowerTimers.forEach((timer) => window.clearTimeout(timer));
    cardLowerTimers.clear();
    document.querySelectorAll(".annotation-connector").forEach((el) => el.remove());
    rails.forEach((item) => { item.innerHTML = ""; });
    const sorted = visibleAnnotations()
      .slice()
      .sort((a, b) => anchorRect(a).top - anchorRect(b).top);
    const layout = availableRails();
    Object.values(layout).forEach((item) => {
      if (item?.rail) item.rail.style.setProperty("--annotation-rail-left", `${item.left}px`);
    });
    const sideState = {
      left: { overlapDepth: 0, overlapBottom: -Infinity, lineRows: new Map() },
      right: { overlapDepth: 0, overlapBottom: -Infinity, lineRows: new Map() },
    };
    assignAnnotationSides(sorted, layout)
      .forEach(({ annotation, side }) => {
        const sideLayout = layout[side] || layout.right;
        const sideRail = sideLayout.rail || rail;
        const state = sideState[side] || sideState.right;
        const railRect = sideRail.getBoundingClientRect();
        const rectMeta = anchorRect(annotation);
        annotation.top = rectMeta.top;
        annotation.left = rectMeta.left;
        annotation.right = rectMeta.right;
        annotation.height = rectMeta.height;
        const desired = Math.max(0, annotation.top - railRect.top - window.scrollY);
        const top = desired;
        const card = makeCard(annotation, top);
        card.dataset.annotationSide = side;
        if (side === "left") card.style.borderLeftColor = "var(--color-rule, #e3e1da)";
        else card.style.borderRightColor = "var(--color-rule, #e3e1da)";
        sideRail.appendChild(card);
        if (top < state.overlapBottom) state.overlapDepth += 1;
        else state.overlapDepth = 0;
        const railDistance = side === "left"
          ? Math.max(0, railRect.left)
          : Math.max(0, window.innerWidth - railRect.right);
        const overlapStep = railDistance / 4;
        const shift = Math.min(railDistance, state.overlapDepth * overlapStep);
        card.style.left = side === "left" ? `${-shift}px` : `${shift}px`;
        const rect = card.getBoundingClientRect();
        state.overlapBottom = Math.max(state.overlapBottom, top + rect.height);

        const baseY = annotation.top + Math.min(annotation.height / 2, 20);
        const rowKey = Math.round(baseY / 2);
        const rowOffset = (state.lineRows.get(rowKey) || 0) * 2;
        state.lineRows.set(rowKey, (state.lineRows.get(rowKey) || 0) + 1);
        const y = baseY + rowOffset;
        const endX = side === "left" ? rect.right + window.scrollX : rect.left + window.scrollX;
        const startX = side === "left"
          ? Math.min(annotation.left - 10, layout.mainRect.left + window.scrollX - 8)
          : Math.max(annotation.right + 10, layout.mainRect.right + window.scrollX + 8);
        const connector = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        connector.setAttribute("class", "annotation-connector");
        connector.dataset.annotationConnectorId = annotation.id;
        connector.style.left = `${minX}px`;
        connector.style.top = `${y}px`;
        connector.style.width = `${Math.max(1, maxX - minX)}px`;
        connector.style.height = "1px";
        connector.setAttribute("viewBox", `0 0 ${Math.max(1, maxX - minX)} 1`);
        line.setAttribute("x1", `${startX - minX}`);
        line.setAttribute("y1", "0.5");
        line.setAttribute("x2", `${endX - minX}`);
        line.setAttribute("y2", "0.5");
        connector.appendChild(line);
        document.body.appendChild(connector);
      });
    syncAnnotationMarks();
    renderTocNoteMarkers();
  }

  function headingForAnnotation(annotation) {
    const headings = Array.from(main.querySelectorAll("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"));
    let current = headings[0];
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top + window.scrollY <= annotation.top + 4) current = heading;
      else break;
    }
    return current;
  }

  function headingForAnnotationInToc(annotation, toc) {
    const tocHeadingIds = new Set(Array.from(toc.querySelectorAll("a[href]"))
      .map((link) => {
        try {
          const hash = new URL(link.getAttribute("href"), location.href).hash;
          return hash ? decodeURIComponent(hash.slice(1)) : "";
        } catch {
          return String(link.getAttribute("href") || "").replace(/^#/, "");
        }
      })
      .filter(Boolean));
    const headings = Array.from(main.querySelectorAll("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"))
      .filter((heading) => tocHeadingIds.has(heading.id));
    if (!headings.length) return headingForAnnotation(annotation);
    let current = headings[0];
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top + window.scrollY <= annotation.top + 4) current = heading;
      else break;
    }
    return current;
  }

  function tocLinkForHeading(toc, headingId) {
    return Array.from(toc.querySelectorAll("a[href]")).find((link) => {
      try {
        return decodeURIComponent(new URL(link.getAttribute("href"), location.href).hash.slice(1)) === headingId;
      } catch {
        return String(link.getAttribute("href") || "").replace(/^#/, "") === headingId;
      }
    });
  }

  function highlightAnnotation(id, on) {
    cardForAnnotation(id)?.classList.toggle("annotation-active", on);
    document.querySelectorAll(`[data-annotation-id="${CSS.escape(id)}"]`).forEach((mark) => {
      mark.classList.toggle("annotation-active", on);
    });
    document.querySelectorAll(`[data-annotation-connector-id="${CSS.escape(id)}"]`).forEach((connector) => {
      connector.classList.toggle("annotation-active", on);
    });
  }

  function renderTocNoteMarkers() {
    document.querySelectorAll(".toc-note-markers").forEach((node) => node.remove());
    const toc = document.querySelector("#TOC, nav[role='doc-toc'], nav.toc, .toc");
    if (!toc) return;
    const grouped = new Map();
    visibleAnnotations().forEach((annotation) => {
      const heading = headingForAnnotationInToc(annotation, toc);
      if (!heading?.id) return;
      if (!grouped.has(heading.id)) grouped.set(heading.id, []);
      grouped.get(heading.id).push(annotation);
    });
    grouped.forEach((items, headingId) => {
      const link = tocLinkForHeading(toc, headingId);
      if (!link) return;
      const wrap = document.createElement("span");
      wrap.className = "toc-note-markers";
      items.forEach((annotation, index) => {
        const dot = document.createElement("button");
        const colors = (annotation.tags || []).map((tag) => tag.color).filter(Boolean);
        dot.type = "button";
        dot.className = "toc-note-dot";
        dot.style.background = tagDotBackground(colors.length ? colors : [palette[index % palette.length]]);
        dot.title = annotation.note ? trimmed(annotation.note, 48) : "跳转到批注";
        dot.setAttribute("aria-label", "跳转到批注");
        dot.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const card = cardForAnnotation(annotation.id);
          (card || document.querySelector(`[data-annotation-id="${CSS.escape(annotation.id)}"]`))?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
          highlightAnnotation(annotation.id, true);
          window.setTimeout(() => highlightAnnotation(annotation.id, false), 1400);
        });
        dot.addEventListener("mouseenter", () => highlightAnnotation(annotation.id, true));
        dot.addEventListener("mouseleave", () => highlightAnnotation(annotation.id, false));
        wrap.appendChild(dot);
      });
      link.appendChild(wrap);
    });
  }

  function selectedExportTags() {
    return Array.from(exportTags?.querySelectorAll("input[type='checkbox']:checked") || []).map((input) => input.value);
  }

  function renderExportTags() {
    if (!exportTags) return;
    const current = selectedExportTags();
    const selected = new Set(current.length ? current : defaultExportTagNames());
    exportTags.innerHTML = "";
    tags.forEach((tag) => {
      const label = document.createElement("label");
      label.className = "annotation-export-tag";
      label.style.setProperty("--tag-color", tag.color);
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = tag.name;
      input.checked = selected.has(tag.name);
      label.append(input, document.createTextNode(tag.name));
      exportTags.appendChild(label);
    });
  }

  function annotationsForExport() {
    const selected = new Set(selectedExportTags());
    const tagOrder = new Map(tags.map((tag, index) => [tag.name, index]));
    const orderOf = (annotation) => {
      const names = (annotation.tags || []).map((tag) => tag.name);
      const indexes = names.map((name) => tagOrder.get(name)).filter((index) => index !== undefined);
      return indexes.length ? Math.min(...indexes) : tags.length;
    };
    const headingTop = (annotation) => {
      const heading = headingForAnnotation(annotation);
      return heading ? heading.getBoundingClientRect().top + window.scrollY : annotation.top || 0;
    };
    const items = visibleAnnotations().slice().sort((a, b) => headingTop(a) - headingTop(b) || orderOf(a) - orderOf(b) || (a.top || 0) - (b.top || 0));
    if (!selected.size) return items;
    return items.filter((annotation) => (annotation.tags || []).some((tag) => selected.has(tag.name)));
  }

  function annotationExportTag(annotation) {
    const selected = new Set(selectedExportTags());
    const names = (annotation.tags || []).map((tag) => tag.name);
    if (selected.size) return names.find((name) => selected.has(name)) || names[0] || "无标签";
    for (const tag of tags) {
      if (names.includes(tag.name)) return tag.name;
    }
    return names[0] || "无标签";
  }

  function headingTitle(annotation) {
    const heading = headingForAnnotation(annotation);
    return heading?.textContent?.trim() || "正文目录";
  }

  function htmlFileName() {
    const name = decodeURIComponent(location.pathname.split("/").pop() || "");
    return name || document.title || "当前HTML文件";
  }

  function tagStats(items) {
    const counts = new Map(tags.map((tag) => [tag.name, 0]));
    let untagged = 0;
    items.forEach((annotation) => {
      const names = (annotation.tags || []).map((tag) => tag.name);
      if (!names.length) {
        untagged += 1;
        return;
      }
      names.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
    });
    return { counts, untagged };
  }

  function buildAnnotationsMarkdown(items) {
    const selected = selectedExportTags();
    const stats = tagStats(items);
    const tagCounters = new Map();
    let currentHeading = "";
    const lines = [
      `# ${pageTitle()} - 批注导出`,
      "",
      "## 说明",
      "",
      "这个 Markdown 文件由 HTML 批注系统导出，用于汇总正文引用、标签和批注内容，方便后续交给 GPT 继续分析。",
      "",
      `- HTML文件名: ${htmlFileName()}`,
      `- 标签筛选: ${selected.length ? selected.join(", ") : "全部"}`,
      `- 批注数量: ${items.length}`,
      "",
      "## 规则",
      "",
      "- 批注按标签顺序排列；同一标签下按正文出现顺序排列。",
      "- 每条批注先给出引用正文，再给出“标签编号：批注内容”。",
      "- 不导出时间戳。",
      "",
      "## 标签统计",
      "",
    ];
    tags.forEach((tag) => {
      lines.push(`- ${tag.name}: ${stats.counts.get(tag.name) || 0}`);
    });
    if (stats.untagged) lines.push(`- 无标签: ${stats.untagged}`);
    lines.push("");

    items.forEach((annotation, index) => {
      const heading = headingTitle(annotation);
      if (heading !== currentHeading) {
        currentHeading = heading;
        lines.push(`## ${heading}`, "");
      }
      const label = annotationExportTag(annotation);
      tagCounters.set(label, (tagCounters.get(label) || 0) + 1);
      lines.push(markdownQuote(annotation.text), "");
      lines.push(`${label}${tagCounters.get(label)}：${escapeMarkdown(annotation.note) || "（无文本批注）"}`, "");
      if (annotation.board) {
        lines.push(`![图案 ${index + 1}](${annotation.board})`, "");
      }
    });
    return lines.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  function downloadMarkdown(text) {
    downloadFile(text, exportFileName(), "text/markdown;charset=utf-8");
  }

  function downloadFile(text, fileName, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportAnnotationsMarkdown() {
    const items = annotationsForExport();
    if (!items.length) {
      window.alert("没有符合条件的批注可导出。");
      return;
    }
    downloadMarkdown(buildAnnotationsMarkdown(items));
  }

  function embeddedPayload() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      sourcePath: location.pathname,
      annotations,
      tags,
      layers: layerState,
    };
  }

  function htmlWithEmbeddedNotes() {
    captureOriginalMathSources();
    const doc = document.documentElement.cloneNode(true);
    doc.querySelectorAll(".annotation-connector").forEach((node) => node.remove());
    doc.querySelectorAll(".annotation-rail").forEach((node) => { node.innerHTML = ""; });
    doc.querySelectorAll(".annotation-export-panel").forEach((node) => { node.hidden = true; });
    doc.querySelectorAll(".annotation-popover").forEach((node) => { node.dataset.open = "false"; });
    doc.querySelectorAll("[data-annotation-id],[data-annotation-preview-id]").forEach((node) => {
      if (node.tagName === "MARK") {
        node.replaceWith(...node.childNodes);
        return;
      }
      node.classList.remove("annotation-block", "annotation-phrase", "annotation-active", "annotation-editing", "annotation-preview");
      delete node.dataset.annotationId;
      delete node.dataset.annotationPreviewId;
    });
    doc.querySelectorAll(".math.inline,.math.display,math").forEach((node) => {
      const source = node.dataset.htmlNoteMathSource || node.querySelector?.("annotation")?.textContent || "";
      if (!source.trim()) return;
      if (node.tagName.toLowerCase() !== "math") {
        node.innerHTML = "";
        node.textContent = source;
      }
      node.removeAttribute("tabindex");
      node.classList.remove("annotation-block", "annotation-phrase", "annotation-active", "annotation-editing", "annotation-preview");
      delete node.dataset.annotationId;
      delete node.dataset.annotationPreviewId;
    });
    const oldData = doc.querySelector(`#${embeddedDataId}`);
    if (oldData) oldData.remove();
    const data = document.createElement("script");
    data.type = "application/json";
    data.id = embeddedDataId;
    data.textContent = JSON.stringify(embeddedPayload());
    const body = doc.querySelector("body") || doc;
    const marker = Array.from(body.childNodes).find((node) => node.nodeType === Node.COMMENT_NODE && node.nodeValue.trim() === "html-note:start");
    if (marker) body.insertBefore(data, marker);
    else body.appendChild(data);
    return `<!DOCTYPE html>\n${doc.outerHTML}`;
  }

  function exportAnnotatedHtml() {
    saveAll();
    downloadFile(htmlWithEmbeddedNotes(), exportHtmlFileName(), "text/html;charset=utf-8");
  }

  function tagDotBackground(colors) {
    if (colors.length <= 1) return colors[0] || palette[0];
    const step = 100 / colors.length;
    const stops = colors.map((color, index) => {
      const start = Math.round(index * step);
      const end = Math.round((index + 1) * step);
      return `${color} ${start}% ${end}%`;
    });
    return `linear-gradient(to bottom, ${stops.join(", ")})`;
  }

  function addSelectionMark(annotation) {
    const previews = Array.from(document.querySelectorAll(`[data-annotation-preview-id="${CSS.escape(annotation.id)}"]`));
    if (previews.length) {
      previews.forEach((preview) => {
        preview.dataset.annotationId = annotation.id;
        delete preview.dataset.annotationPreviewId;
        preview.classList.remove("annotation-preview");
        setMarkColors(preview, annotation);
      });
      markMathContainersForAnnotation(annotation);
      return;
    }
    if (validStoredRange(activeRange)) wrapRange(activeRange.cloneRange(), annotation);
    else markExistingElement(nearestBlockForAnnotation(annotation), annotation);
    markMathContainersForAnnotation(annotation);
  }

  function rangeTextSlices(range) {
    const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer;
    const slices = [];
    if (!root) return slices;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest?.(`mark,script,style,${mathSelector},.annotation-rail,.annotation-popover,.annotation-export,#TOC,nav[role='doc-toc'],nav.toc,.toc`)) return NodeFilter.FILTER_REJECT;
        try {
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } catch {
          return NodeFilter.FILTER_REJECT;
        }
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;
      if (end > start && node.nodeValue.slice(start, end).trim()) slices.push({ node, start, end });
    }
    return slices;
  }

  function wrapTextSlices(range, id, className, dataName) {
    const slices = rangeTextSlices(range);
    const annotation = annotations.find((item) => item.id === id);
    wrapTextSliceItems(slices, id, className, dataName, annotation);
    return slices.length > 0;
  }

  function wrapTextSliceItems(slices, id, className, dataName, annotation = null) {
    slices.slice().reverse().forEach(({ node, start, end }) => {
      const mark = document.createElement("mark");
      mark.dataset[dataName] = id;
      mark.className = className;
      if (annotation) setMarkColors(mark, annotation);
      const piece = document.createRange();
      piece.setStart(node, start);
      piece.setEnd(node, end);
      piece.surroundContents(mark);
    });
  }

  function segmentTextsFromRange(range) {
    return rangeTextSlices(range).map(({ node, start, end }) => node.nodeValue.slice(start, end));
  }

  function wrapRange(range, annotation) {
    const didWrap = wrapTextSlices(range, annotation.id, "annotation-phrase", "annotationId");
    markMathContainersForAnnotation(annotation);
    return didWrap || (annotation.mathIds || []).some((id) => document.getElementById(id)?.dataset?.annotationId === annotation.id);
  }

  function rangeFromExistingMarks(id) {
    const marks = Array.from(document.querySelectorAll(`[data-annotation-id="${CSS.escape(id)}"]`));
    if (!marks.length) return null;
    const range = document.createRange();
    range.setStartBefore(marks[0]);
    range.setEndAfter(marks[marks.length - 1]);
    return validStoredRange(range) ? range : null;
  }

  function addSelectionPreview(meta) {
    if (!validStoredRange(activeRange)) return;
    const previewRange = activeRange.cloneRange();
    withSuppressedSelection(() => {
      wrapTextSlices(previewRange, meta.id, "annotation-phrase annotation-preview", "annotationPreviewId");
      mathContainersInRange(previewRange).forEach((element) => {
        element.dataset.annotationPreviewId = meta.id;
        element.classList.add("annotation-block", "annotation-preview");
        setMarkColors(element, meta);
      });
    });
  }

  function clearSelectionPreview() {
    document.querySelectorAll("[data-annotation-preview-id]").forEach((mark) => {
      if (mark.tagName === "MARK") {
        mark.replaceWith(...mark.childNodes);
        return;
      }
      mark.classList.remove("annotation-block", "annotation-preview");
      delete mark.dataset.annotationPreviewId;
    });
  }

  function markMathContainersForAnnotation(annotation) {
    (annotation.mathIds || []).forEach((id) => markMathElement(document.getElementById(id), annotation));
  }

  function inferMathIdsForAnnotation(annotation) {
    if (Array.isArray(annotation.mathIds) && annotation.mathIds.length) return annotation.mathIds;
    const text = compactText(annotation.text);
    if (!text) return [];
    return Array.from(main.querySelectorAll(mathSelector))
      .filter((element) => element.id)
      .filter((element) => {
        const mathText = compactText(element.textContent);
        return mathText && (text.includes(mathText) || mathText.includes(text));
      })
      .map((element) => element.id);
  }

  function markExistingElement(element, annotation) {
    if (!element || isAnnotationUiNode(element) || isTocNode(element) || element.closest?.(`mark,script,style,${mathSelector},${anchorSelector}`)) return false;
    element.dataset.annotationId = annotation.id;
    element.classList.add(annotation.blocky ? "annotation-block" : "annotation-phrase");
    setMarkColors(element, annotation);
    return true;
  }

  function nearestBlockForAnnotation(annotation) {
    const candidates = Array.from(main.querySelectorAll(blockSelector));
    if (!candidates.length) return null;
    let best = null;
    let bestDistance = Infinity;
    candidates.forEach((candidate) => {
      if (isAnnotationUiNode(candidate)) return;
      if (isTocNode(candidate)) return;
      if (candidate.closest("mark")) return;
      const rect = candidate.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const center = rect.top + window.scrollY + rect.height / 2;
      const target = annotation.top + Math.min((annotation.height || 20) / 2, 20);
      const distance = Math.abs(center - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    });
    return bestDistance < 110 ? best : null;
  }

  function restoreAnnotationParts(annotation) {
    if (!Array.isArray(annotation.parts) || !annotation.parts.length) return false;
    let restored = false;
    const textSlices = [];
    annotation.parts.forEach((part) => {
      if (part?.type === "text" && part.anchor) {
        const range = rangeForTextAnchor({ anchor: part.anchor });
        if (range) textSlices.push(...rangeTextSlices(range));
      }
      if (part?.type === "math") {
        restored = markMathElement(mathElementForPart(part), annotation) || restored;
      }
    });
    if (textSlices.length) {
      wrapTextSliceItems(textSlices, annotation.id, "annotation-phrase", "annotationId", annotation);
      restored = true;
    }
    return restored;
  }

  function restoreSelectionMarks() {
    annotations.forEach((annotation) => {
      if (!isLayerVisible(annotation.layerId)) return;
      if (document.querySelector(`[data-annotation-id="${CSS.escape(annotation.id)}"]`)) return;
      annotation.mathIds = inferMathIdsForAnnotation(annotation);
      if (restoreAnnotationParts(annotation)) return;
      markMathContainersForAnnotation(annotation);
      const anchoredRange = rangeForTextAnchor(annotation);
      if (anchoredRange && wrapRange(anchoredRange, annotation)) return;
      if (Array.isArray(annotation.segments) && annotation.segments.length) {
        let restored = false;
        annotation.segments.forEach((segment) => {
          const needlePart = String(segment || "");
          if (!needlePart.trim()) return;
          if (document.querySelector(`[data-annotation-id="${CSS.escape(annotation.id)}"]`)) return;
          const range = rangeForExactText(needlePart, annotation);
          if (range) restored = wrapTextSlices(range, annotation.id, "annotation-phrase", "annotationId") || restored;
        });
        if (restored) return;
      }
      const needle = annotation.text.trim();
      if (annotation.blocky && markExistingElement(nearestBlockForAnnotation(annotation), annotation)) return;
      if (!needle || needle.length > 180) {
        markExistingElement(nearestBlockForAnnotation(annotation), annotation);
        return;
      }
      const range = rangeForExactText(needle, annotation);
      if (!range) {
        markExistingElement(nearestBlockForAnnotation(annotation), annotation);
        return;
      }
      wrapRange(range, annotation);
      if (!document.querySelector(`[data-annotation-id="${CSS.escape(annotation.id)}"]`)) {
        markExistingElement(nearestBlockForAnnotation(annotation), annotation);
      }
    });
  }

  function rangeForExactText(needle, annotation = null) {
    let best = null;
    let bestDistance = Infinity;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.includes(needle)) return NodeFilter.FILTER_REJECT;
        if (isIgnoredAnchorTextNode(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      let offset = node.nodeValue.indexOf(needle);
      while (offset !== -1) {
        let distance = 0;
        if (annotation && typeof annotation.top === "number") {
          const test = document.createRange();
          test.setStart(node, offset);
          test.setEnd(node, offset + needle.length);
          const rect = test.getBoundingClientRect();
          distance = Math.abs((rect.top + window.scrollY) - annotation.top);
        }
        if (!best || distance < bestDistance) {
          best = { node, offset };
          bestDistance = distance;
        }
        offset = node.nodeValue.indexOf(needle, offset + 1);
      }
    }
    if (!best) return null;
    const range = document.createRange();
    range.setStart(best.node, best.offset);
    range.setEnd(best.node, best.offset + needle.length);
    return range;
  }

  function unwrapAnnotation(id) {
    document.querySelectorAll(`[data-annotation-id="${CSS.escape(id)}"]`).forEach((mark) => {
      if (mark.tagName === "MARK") {
        mark.replaceWith(...mark.childNodes);
        return;
      }
      mark.classList.remove("annotation-block", "annotation-phrase", "annotation-active", "annotation-editing");
      delete mark.dataset.annotationId;
    });
  }

  document.addEventListener("selectionchange", () => {
    if (suppressSelection) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!main.contains(range.commonAncestorContainer)) return;
    if (isAnnotationUiNode(range.commonAncestorContainer)) return;
    if (isTocNode(range.commonAncestorContainer)) return;
    const text = selection.toString().trim();
    if (!text) return;
    window.clearTimeout(selectionTimer);
    const savedRange = range.cloneRange();
    selectionTimer = window.setTimeout(() => {
      if (validStoredRange(savedRange)) openPopover(rangeMeta(savedRange), savedRange);
    }, 220);
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (target.closest?.(".annotation-popover,.annotation-rail,.annotation-export")) return;
    if (exportPanel && !exportPanel.hidden) exportPanel.hidden = true;
    if (pop.dataset.open === "true" && !editingId) closePopover();
  });

  exportOpen.addEventListener("click", () => {
    renderExportTags();
    renderLayerList();
    exportPanel.hidden = !exportPanel.hidden;
  });
  exportClose?.addEventListener("click", () => {
    exportPanel.hidden = true;
  });
  exportAll?.addEventListener("click", () => {
    exportTags?.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = true;
    });
  });
  exportClear?.addEventListener("click", () => {
    exportTags?.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = false;
    });
  });
  clearTags?.addEventListener("click", clearAllAnnotations);
  exportDownload?.addEventListener("click", exportAnnotationsMarkdown);
  exportHtml?.addEventListener("click", exportAnnotatedHtml);
  layerAdd?.addEventListener("click", () => {
    const name = window.prompt("新图层名称", nextLayerName());
    const cleanName = String(name || "").trim();
    if (!cleanName) return;
    const layer = {
      id: `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: cleanName,
      visible: true,
    };
    layerState.items.push(layer);
    layerState.activeId = layer.id;
    saveAll();
    renderLayerList();
    refreshAnnotationVisibility();
  });
  layerList?.addEventListener("change", (event) => {
    const id = event.target?.dataset?.layerVisible;
    const layer = id ? layerById(id) : null;
    if (!layer) return;
    layer.visible = event.target.checked;
    if (!layer.visible && layer.id === activeLayer().id) {
      const nextVisible = layerState.items.find((item) => item.visible !== false);
      if (nextVisible) layerState.activeId = nextVisible.id;
      else layer.visible = true;
    }
    saveAll();
    renderLayerList();
    refreshAnnotationVisibility();
  });
  layerList?.addEventListener("click", (event) => {
    const currentId = event.target?.dataset?.layerCurrent;
    const renameId = event.target?.dataset?.layerRename;
    if (currentId) setActiveLayer(currentId);
    if (renameId) {
      const layer = layerById(renameId);
      if (!layer) return;
      const name = window.prompt("图层名称", layer.name);
      const cleanName = String(name || "").trim();
      if (!cleanName) return;
      layer.name = cleanName;
      saveAll();
      renderLayerList();
    }
  });
  bodyBackgroundToggle?.addEventListener("click", () => {
    bodyBackgroundOn = !bodyBackgroundOn;
    saveBodyBackground();
    syncAnnotationMarks();
  });

  tagInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addCurrentTag();
  });
  tagConfirm?.addEventListener("click", addCurrentTag);

  close.addEventListener("click", closePopover);
  noteInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    commitPopover();
  });
  copy.addEventListener("click", async () => {
    if (!activeSelection) return;
    try {
      await navigator.clipboard.writeText(activeSelection.text);
    } catch {
      const temp = document.createElement("textarea");
      temp.value = activeSelection.text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      temp.remove();
    }
  });
  toggleBoard.addEventListener("click", () => {
    boardMode = !boardMode;
    pop.dataset.board = String(boardMode);
    toggleBoard.title = boardMode ? "回到文本" : "进入画板";
    toggleBoard.setAttribute("aria-label", boardMode ? "回到文本" : "进入画板");
  });
  done.addEventListener("click", commitPopover);

  pop.querySelectorAll(".board-tools [data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tool = btn.dataset.tool;
      pop.querySelectorAll(".board-tools [data-tool]").forEach((item) => item.setAttribute("aria-pressed", String(item === btn)));
    });
  });

  board.addEventListener("pointerdown", (event) => {
    drawing = true;
    start = canvasPoint(event);
    snapshot = ctx.getImageData(0, 0, board.width, board.height);
    board.setPointerCapture(event.pointerId);
    if (tool === "pen" || tool === "eraser") drawLine(start, start, tool);
  });
  board.addEventListener("pointermove", (event) => {
    if (!drawing || !start) return;
    const next = canvasPoint(event);
    if (tool === "pen" || tool === "eraser") {
      drawLine(start, next, tool);
      start = next;
      return;
    }
    restoreSnapshot(snapshot);
    drawShape(start, next);
  });
  board.addEventListener("pointerup", (event) => {
    if (!drawing) return;
    const end = canvasPoint(event);
    if (tool !== "pen" && tool !== "eraser" && start) {
      restoreSnapshot(snapshot);
      drawShape(start, end);
    }
    drawing = false;
    start = null;
    snapshot = null;
    board.releasePointerCapture(event.pointerId);
    pushUndo();
  });
  board.addEventListener("pointercancel", () => {
    if (tool !== "pen" && tool !== "eraser") restoreSnapshot(snapshot);
    drawing = false;
    start = null;
    snapshot = null;
    pushUndo();
  });
  undo.addEventListener("click", () => {
    if (undoStack.length <= 1) return;
    redoStack.push(undoStack.pop());
    loadCanvasState(undoStack[undoStack.length - 1]);
  });
  redo.addEventListener("click", () => {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(next);
    loadCanvasState(next);
  });
  pasteImage.addEventListener("click", () => boardFile.click());
  boardFile.addEventListener("change", () => {
    const file = boardFile.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const width = Math.min(image.width, 520);
        const height = width * (image.height / image.width);
        ctx.drawImage(image, 32, 32, width, height);
        pushUndo();
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
    boardFile.value = "";
  });
  document.addEventListener("paste", (event) => {
    if (pop.dataset.open !== "true" || pop.dataset.board !== "true") return;
    const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const width = Math.min(image.width, 520);
        const height = width * (image.height / image.width);
        ctx.drawImage(image, 32, 32, width, height);
        pushUndo();
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  function handleRailClick(event) {
    const target = event.target;
    const editId = target?.dataset?.edit;
    const copyId = target?.dataset?.copy;
    const deleteId = target?.dataset?.delete;
    if (editId) {
      const annotation = annotations.find((item) => item.id === editId);
      if (annotation) openEditor(annotation);
    }
    if (copyId) {
      const annotation = annotations.find((item) => item.id === copyId);
      if (!annotation) return;
      navigator.clipboard?.writeText(`${annotation.text}\n\n${annotation.note || ""}`.trim()).catch(() => {
        const temp = document.createElement("textarea");
        temp.value = `${annotation.text}\n\n${annotation.note || ""}`.trim();
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      });
    }
    if (deleteId) {
      annotations = annotations.filter((item) => item.id !== deleteId);
      unwrapAnnotation(deleteId);
      saveAll();
      renderAnnotations();
    }
  }

  function handleRailDblClick(event) {
    const note = event.target?.closest?.("[data-quick-edit]");
    if (!note?.dataset?.quickEdit) return;
    event.preventDefault();
    const annotation = annotations.find((item) => item.id === note.dataset.quickEdit);
    if (annotation) quickEditNote(note, annotation);
  }

  function handleRailFocusIn(event) {
    const card = event.target?.closest?.(".annotation-card");
    if (!card?.dataset?.id) return;
    raiseCard(card, true);
  }

  function handleRailFocusOut(event) {
    const card = event.target?.closest?.(".annotation-card");
    if (!card?.dataset?.id || card.contains(event.relatedTarget)) return;
    scheduleLowerCard(card);
  }

  rails.forEach((item) => {
    item.addEventListener("click", handleRailClick);
    item.addEventListener("dblclick", handleRailDblClick);
    item.addEventListener("focusin", handleRailFocusIn);
    item.addEventListener("focusout", handleRailFocusOut);
  });

  main.addEventListener("mouseover", (event) => {
    const mark = event.target?.closest?.(anchorSelector);
    if (!mark?.dataset?.annotationId || isAnnotationUiNode(mark) || isTocNode(mark)) return;
    raiseAnnotation(mark.dataset.annotationId, true);
  });
  main.addEventListener("mouseout", (event) => {
    const mark = event.target?.closest?.(anchorSelector);
    if (!mark?.dataset?.annotationId || mark.contains(event.relatedTarget)) return;
    raiseAnnotation(mark.dataset.annotationId, false);
  });
  main.addEventListener("focusin", (event) => {
    const mark = event.target?.closest?.(anchorSelector);
    if (!mark?.dataset?.annotationId || isAnnotationUiNode(mark) || isTocNode(mark)) return;
    raiseAnnotation(mark.dataset.annotationId, true);
  });
  main.addEventListener("focusout", (event) => {
    const mark = event.target?.closest?.(anchorSelector);
    if (!mark?.dataset?.annotationId || mark.contains(event.relatedTarget)) return;
    raiseAnnotation(mark.dataset.annotationId, false);
  });

  window.addEventListener("resize", renderAnnotations);
  window.addEventListener("scroll", () => requestAnimationFrame(renderAnnotations), { passive: true });
  clearBoard();
  restoreSelectionMarks();
  syncAnnotationMarks();
  renderExportTags();
  renderLayerList();
  renderAnnotations();
})();
