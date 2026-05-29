from __future__ import annotations

import re
from dataclasses import dataclass, field

from docx.document import Document as DocxDocument
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt
from docx.text.paragraph import Paragraph


@dataclass(slots=True)
class InlineToken:
    kind: str
    text: str = ""
    children: list["InlineToken"] = field(default_factory=list)


@dataclass(slots=True)
class MarkdownBlock:
    kind: str
    tokens: list[InlineToken] = field(default_factory=list)
    items: list[list[InlineToken]] = field(default_factory=list)
    level: int = 0


class MarkdownDocxRenderer:
    def render(self, document: DocxDocument, markdown: str, *, first_line_indent: float = 20) -> None:
        blocks = parse_markdown(markdown)
        for block in blocks:
            self._render_block(document, block, first_line_indent=first_line_indent)

    def render_numbered_item(self, document: DocxDocument, index: int, markdown: str) -> None:
        blocks = parse_markdown(markdown)
        if not blocks:
            self._render_prefixed_paragraph(document, [InlineToken(kind="text", text=f"{index}.")], first_line_indent=20)
            return

        is_first_block = True
        for block in blocks:
            prefix = f"{index}. " if is_first_block else None
            self._render_block(document, block, first_line_indent=20, first_prefix=prefix, nested=not is_first_block)
            is_first_block = False

    def _render_block(
        self,
        document: DocxDocument,
        block: MarkdownBlock,
        *,
        first_line_indent: float,
        first_prefix: str | None = None,
        nested: bool = False,
    ) -> None:
        if block.kind == "paragraph":
            self._render_prefixed_paragraph(
                document,
                block.tokens,
                prefix=first_prefix,
                first_line_indent=first_line_indent if not nested else 0,
                left_indent=20 if nested else 0,
            )
            return

        if block.kind == "heading":
            paragraph = document.add_paragraph()
            paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
            paragraph.paragraph_format.space_after = Pt(0)
            if nested:
                paragraph.paragraph_format.left_indent = Pt(20)
            if first_prefix:
                self._append_run(paragraph, first_prefix, bold=True, size=16 - block.level)
            self._append_tokens(paragraph, block.tokens, bold=True, size=16 - block.level)
            return

        if block.kind == "blockquote":
            paragraph = document.add_paragraph()
            paragraph.paragraph_format.first_line_indent = Pt(0)
            paragraph.paragraph_format.left_indent = Pt(24 if not nested else 36)
            paragraph.paragraph_format.space_after = Pt(0)
            if first_prefix:
                self._append_run(paragraph, first_prefix, italic=True)
            self._append_tokens(paragraph, block.tokens, italic=True)
            return

        if block.kind == "unordered-list":
            for item_index, item_tokens in enumerate(block.items):
                prefix = first_prefix if item_index == 0 and first_prefix else ""
                bullet = f"{prefix}• "
                self._render_prefixed_paragraph(
                    document,
                    item_tokens,
                    prefix=bullet,
                    first_line_indent=0,
                    left_indent=20 if not nested else 36,
                )
            return

        if block.kind == "ordered-list":
            for item_index, item_tokens in enumerate(block.items, start=1):
                prefix = first_prefix if item_index == 1 and first_prefix else ""
                numbering = f"{prefix}{item_index}. "
                self._render_prefixed_paragraph(
                    document,
                    item_tokens,
                    prefix=numbering,
                    first_line_indent=0,
                    left_indent=20 if not nested else 36,
                )

    def _render_prefixed_paragraph(
        self,
        document: DocxDocument,
        tokens: list[InlineToken],
        *,
        prefix: str | None = None,
        first_line_indent: float = 20,
        left_indent: float = 0,
    ) -> None:
        paragraph = document.add_paragraph()
        paragraph.paragraph_format.first_line_indent = Pt(first_line_indent)
        paragraph.paragraph_format.left_indent = Pt(left_indent)
        paragraph.paragraph_format.space_after = Pt(0)
        if prefix:
            self._append_run(paragraph, prefix)
        self._append_tokens(paragraph, tokens)

    def _append_tokens(
        self,
        paragraph: Paragraph,
        tokens: list[InlineToken],
        *,
        bold: bool = False,
        italic: bool = False,
        size: int = 14,
    ) -> None:
        for token in tokens:
            if token.kind == "text":
                self._append_run(paragraph, token.text, bold=bold, italic=italic, size=size)
                continue
            if token.kind == "bold":
                self._append_tokens(paragraph, token.children, bold=True, italic=italic, size=size)
                continue
            if token.kind == "italic":
                self._append_tokens(paragraph, token.children, bold=bold, italic=True, size=size)
                continue
            if token.kind == "code":
                run = paragraph.add_run(token.text)
                run.bold = bold
                run.italic = italic
                run.font.name = "Courier New"
                run.font.size = Pt(size)

    def _append_run(
        self,
        paragraph: Paragraph,
        text: str,
        *,
        bold: bool = False,
        italic: bool = False,
        size: int = 14,
    ) -> None:
        run = paragraph.add_run(text)
        run.bold = bold
        run.italic = italic
        run.font.name = "Times New Roman"
        run.font.size = Pt(size)


def parse_markdown(markdown: str) -> list[MarkdownBlock]:
    lines = markdown.replace("\r\n", "\n").split("\n")
    blocks: list[MarkdownBlock] = []
    index = 0

    while index < len(lines):
        line = lines[index].rstrip()
        if not line.strip():
            index += 1
            continue

        heading_match = re.match(r"^(#{1,3})\s+(.*)$", line)
        if heading_match:
            blocks.append(
                MarkdownBlock(
                    kind="heading",
                    level=len(heading_match.group(1)),
                    tokens=parse_inline(heading_match.group(2).strip()),
                )
            )
            index += 1
            continue

        if re.match(r"^\s*>\s?", line):
            quote_lines: list[str] = []
            while index < len(lines) and re.match(r"^\s*>\s?", lines[index]):
                quote_lines.append(re.sub(r"^\s*>\s?", "", lines[index]).strip())
                index += 1
            blocks.append(MarkdownBlock(kind="blockquote", tokens=parse_inline(" ".join(filter(None, quote_lines)))))
            continue

        if re.match(r"^\s*[-*]\s+", line):
            items: list[list[InlineToken]] = []
            while index < len(lines) and re.match(r"^\s*[-*]\s+", lines[index]):
                items.append(parse_inline(re.sub(r"^\s*[-*]\s+", "", lines[index]).strip()))
                index += 1
            blocks.append(MarkdownBlock(kind="unordered-list", items=items))
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            items = []
            while index < len(lines) and re.match(r"^\s*\d+\.\s+", lines[index]):
                items.append(parse_inline(re.sub(r"^\s*\d+\.\s+", "", lines[index]).strip()))
                index += 1
            blocks.append(MarkdownBlock(kind="ordered-list", items=items))
            continue

        paragraph_lines: list[str] = []
        while index < len(lines):
            next_line = lines[index].rstrip()
            if not next_line.strip() or is_block_boundary(next_line):
                break
            paragraph_lines.append(next_line.strip())
            index += 1
        blocks.append(MarkdownBlock(kind="paragraph", tokens=parse_inline(" ".join(paragraph_lines))))

    return blocks


def is_block_boundary(line: str) -> bool:
    return bool(
        re.match(r"^(#{1,3})\s+", line)
        or re.match(r"^\s*>\s?", line)
        or re.match(r"^\s*[-*]\s+", line)
        or re.match(r"^\s*\d+\.\s+", line)
    )


def parse_inline(text: str) -> list[InlineToken]:
    tokens: list[InlineToken] = []
    cursor = 0

    while cursor < len(text):
        if text.startswith("**", cursor):
            closing = text.find("**", cursor + 2)
            if closing > cursor + 2:
                tokens.append(InlineToken(kind="bold", children=parse_inline(text[cursor + 2 : closing])))
                cursor = closing + 2
                continue

        if text.startswith("*", cursor):
            closing = text.find("*", cursor + 1)
            if closing > cursor + 1:
                tokens.append(InlineToken(kind="italic", children=parse_inline(text[cursor + 1 : closing])))
                cursor = closing + 1
                continue

        if text.startswith("`", cursor):
            closing = text.find("`", cursor + 1)
            if closing > cursor + 1:
                tokens.append(InlineToken(kind="code", text=text[cursor + 1 : closing]))
                cursor = closing + 1
                continue

        next_marker = find_next_inline_marker(text, cursor)
        tokens.append(InlineToken(kind="text", text=text[cursor:next_marker]))
        cursor = next_marker

    return [token for token in tokens if token.kind != "text" or token.text]


def find_next_inline_marker(text: str, cursor: int) -> int:
    candidates = [text.find("**", cursor), text.find("*", cursor), text.find("`", cursor)]
    existing = [candidate for candidate in candidates if candidate >= 0]
    return min(existing) if existing else len(text)


markdown_docx_renderer = MarkdownDocxRenderer()
