<p align="center">
  <img src="assets/readme/logo-html-note.png" width="180" alt="HTML-NOTE logo">
</p>

<p align="center">
  <em>"Let focused reading distill thinking. Step into HTML 2.0."</em><br>
  <em>「在专注阅读中沉淀思考，迈向 HTML 2.0。」</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-black.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/local--first-yes-2f855a" alt="Local first">
  <img src="https://img.shields.io/badge/agent-skill-444" alt="Agent skill">
  <img src="https://img.shields.io/badge/html-note-b8653b" alt="html-note">
</p>

<p align="center">
  Say one sentence to your agent. Turn any local HTML into an interactive reading surface with notes, tags, side cards, local storage, and Markdown export.
</p>

<p align="center">
  html-note 把本地 HTML 变成可交互阅读现场：边读边标记，右侧生成批注卡片，一键导出带原文引用的 Markdown，再喂给 AI 做二次深入阅读。
</p>

```bash
npx skills add gouwengone-hash/html-note
```

> 也可以直接对 Codex、Claude Code、Cursor 等工具说：帮我安装 html-note 这个 skill。

![html-note 说明图](assets/readme/html-note-workflow.png)

## 它解决什么

读本地 HTML 长文时，很多人会遇到三个麻烦：

- 想记问题，却要另外打开一个 Markdown 文件，阅读流被打断。
- HTML 本身不能像 PDF 阅读器一样顺手标注重点、疑问和灵感。
- 想让 GPT 深入解释某一段，只能手动一段段复制，引用上下文很容易丢。

html-note 的做法很直接：在 HTML 里加一层可交互的阅读笔记系统。你选中文字，写标记，打标签；页面右侧生成笔记卡片；需要继续分析时，一键导出 Markdown，里面自动带上原文引用和你的标记。阅读过程中，标记会先临时保存在当前浏览器里；**如果想永久保存、换浏览器或发给别人，一定要点击「导出带笔记 HTML」生成新的单文件副本。**

![使用教程](assets/readme/tutorial.gif)

---

## 装上就能用

如果你使用支持 skills 的 AI 编程工具，可以直接安装：

```bash
npx skills add gouwengone-hash/html-note
```

你也可以直接对 Codex、Claude Code、Cursor 等工具说：

```text
帮我安装 html-note 这个 skill
```

然后在 AI 里直接说：

```text
「给这个 HTML 加标记系统」
「给这个 HTML 加批注系统」
「把这篇 md 转成可标记 html」
```

没有账号、没有后台、没有在线面板。产物仍然是一个可以本地打开的 HTML 文件。

---

## 推荐的 HTML 格式

html-note 可以嵌入任何本地 HTML，但最推荐搭配 [huashu-md-html](https://github.com/alchaincyf/huashu-md-html) 生成的 HTML 使用。

huashu-md-html 负责把 Markdown 转成适合阅读的四套主题 HTML；html-note 负责在这些 HTML 上叠加交互式标记、批注卡片、本地存储和 Markdown 导出。

推荐搭配：

| 阅读场景 | 推荐主题 | 为什么适合 html-note |
| --- | --- | --- |
| 长文档、教程、论文式深读 | `interactive` | 左侧目录天然适合和标记圆点配合，读到哪里、记到哪里很清楚 |
| Essay、博客、独立文章 | `article` | 正文两侧通常有留白，适合显示左右批注卡片 |
| 技术报告、表格较多的材料 | `report` | 保留报告宽度和信息密度，适合边读边整理重点 |
| 纯阅读、轻量分发 | `reading` | 干净单栏，适合只保留最小阅读干扰 |

典型闭环是：

```text
Markdown
  -> huashu-md-html 生成阅读型 HTML
  -> html-note 加交互标记系统
  -> 阅读 / 标记 / 导出 Markdown
  -> 喂给 AI 深读
  -> 再生成新的 HTML
```

---

## 四个能力

| 用户想做什么 | html-note 做什么 | 关键产物 |
| --- | --- | --- |
| 「这个 HTML 我想边读边记」 | 给本地 HTML 注入标记系统 | 可标记的 HTML |
| 「我想把疑问、重点分开」 | 用标签管理笔记，右侧显示标记卡片 | 标签化笔记卡片 |
| 「我想把标记再喂给 AI」 | 一键导出带引用的 Markdown | 引用正文 + 标签编号 + 标记内容 |
| 「我不想把资料传到服务器」 | 标记先保存在本机浏览器 `localStorage`，归档时导出带笔记 HTML | 完全本地的阅读数据 |

核心体验：

- 选中正文后弹出标记框，输入框自动聚焦。
- 正文使用虚线下划线标记，可开启标签对应的浅色背景。
- 右侧固定标记卡片，卡片和正文之间用水平虚线连接。
- 支持「疑问 / 灵感 / 重点」等常用标签，也支持扩展标签。
- 支持编辑、复制、删除、双击快速编辑标记文本。
- 支持白板图案：画笔、直线、箭头、矩形、圆、三角、橡皮、撤回、重做、图片粘贴/上传。
- 左侧目录显示标记圆点，方便在长文档里定位读过和记过的地方。
- 一键导出 Markdown，方便继续交给 GPT / Claude / Codex 做深度分析。
- 一键导出带笔记 HTML，把当前批注、图层、标签和白板图案写入新的单 HTML 文件。
- 一键清空标记，删除右侧卡片、正文标记、连接线和本地标记数据。

---

## 适用的工作流

html-note 支持两条最常见的阅读闭环：

```text
HTML
  -> 用户交互式阅读 / 标记
  -> 导出 Markdown
  -> 喂给 AI
  -> 生成新的 HTML
```

```text
HTML
  -> 用户交互式阅读 / 标记
  -> 浏览器本地临时保存
  -> 导出带笔记 HTML
  -> 网盘同步
```

第一条适合把阅读时产生的疑问、重点、灵感继续交给 AI 深挖；第二条适合把 HTML 当成长期阅读档案。注意：浏览器本地保存适合不中断阅读，但它不是可靠的永久文件保存；想长期保存或多设备同步，请先导出带笔记 HTML，再把这个新 HTML 放进网盘。

## 数据与隐私

- 所有标记默认保存在本机浏览器 `localStorage`。
- 不会上传到服务器。
- 不需要登录账号。
- 删除浏览器数据、改文件路径、换浏览器，都可能导致看不到原来的标记。
- 只要浏览器数据还在、文件路径不变，临时保存的标记通常可以在刷新或重新打开后继续显示。
- 如果需要永久保存、换浏览器、换电脑、发给别人或网盘同步，请务必点击「导出带笔记 HTML」。
- 「导出 Markdown」适合把标记交给 AI 深读；「导出带笔记 HTML」才是保存可继续阅读和继续标记的单文件副本。

---

## License

MIT

## Author

Gone，一名 AI 工作流实践者。

联系邮箱：475851386@qq.com
