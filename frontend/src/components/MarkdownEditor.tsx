import { Button, Space, Typography } from "antd";
import type { ReactNode } from "react";
import { Fragment, useId, useRef } from "react";

type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: InlineToken[] }
  | { kind: "italic"; children: InlineToken[] }
  | { kind: "code"; text: string };

type MarkdownBlock =
  | { kind: "paragraph"; tokens: InlineToken[] }
  | { kind: "heading"; level: 1 | 2 | 3; tokens: InlineToken[] }
  | { kind: "blockquote"; tokens: InlineToken[] }
  | { kind: "unordered-list"; items: InlineToken[][] }
  | { kind: "ordered-list"; items: InlineToken[][] };

type MarkdownEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

type ToolbarAction = {
  key: string;
  label: string;
  title: string;
  onClick: (helpers: EditorHelpers) => void;
};

type EditorHelpers = {
  wrapSelection: (before: string, after: string, fallbackText: string) => void;
  prefixLines: (prefixes: string[] | ((index: number) => string)) => void;
  insertText: (text: string) => void;
};

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    key: "bold",
    label: "Ж",
    title: "Жирный",
    onClick: ({ wrapSelection }) => wrapSelection("**", "**", "жирный текст"),
  },
  {
    key: "italic",
    label: "К",
    title: "Курсив",
    onClick: ({ wrapSelection }) => wrapSelection("*", "*", "курсив"),
  },
  {
    key: "code",
    label: "</>",
    title: "Моноширинный фрагмент",
    onClick: ({ wrapSelection }) => wrapSelection("`", "`", "код"),
  },
  {
    key: "heading-1",
    label: "H1",
    title: "Заголовок 1",
    onClick: ({ prefixLines }) => prefixLines(["# "]),
  },
  {
    key: "heading-2",
    label: "H2",
    title: "Заголовок 2",
    onClick: ({ prefixLines }) => prefixLines(["## "]),
  },
  {
    key: "heading-3",
    label: "H3",
    title: "Заголовок 3",
    onClick: ({ prefixLines }) => prefixLines(["### "]),
  },
  {
    key: "bullet-list",
    label: "•",
    title: "Маркированный список",
    onClick: ({ prefixLines }) => prefixLines(() => "- "),
  },
  {
    key: "numbered-list",
    label: "1.",
    title: "Нумерованный список",
    onClick: ({ prefixLines }) => prefixLines((index) => `${index + 1}. `),
  },
  {
    key: "quote",
    label: '"',
    title: "Цитата",
    onClick: ({ prefixLines }) => prefixLines(["> "]),
  },
  {
    key: "paragraph",
    label: "¶",
    title: "Новый абзац",
    onClick: ({ insertText }) => insertText("\n\n"),
  },
];

export function MarkdownEditor({ value = "", onChange, placeholder, rows = 10 }: MarkdownEditorProps) {
  const editorId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const updateValue = (nextValue: string, selectionStart?: number, selectionEnd?: number) => {
    onChange?.(nextValue);
    if (selectionStart === undefined || selectionEnd === undefined) {
      return;
    }

    requestAnimationFrame(() => {
      const textarea = rootRef.current?.querySelector("textarea");
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const helpers: EditorHelpers = {
    wrapSelection: (before, after, fallbackText) => {
      const textarea = rootRef.current?.querySelector("textarea");
      if (!textarea) {
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.slice(start, end) || fallbackText;
      const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
      updateValue(nextValue, start + before.length, start + before.length + selected.length);
    },
    prefixLines: (prefixes) => {
      const textarea = rootRef.current?.querySelector("textarea");
      if (!textarea) {
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const blockStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const blockEndIndex = value.indexOf("\n", end);
      const blockEnd = blockEndIndex === -1 ? value.length : blockEndIndex;
      const selectedBlock = value.slice(blockStart, blockEnd);
      const lines = selectedBlock.length > 0 ? selectedBlock.split("\n") : [""];
      const prefixedLines = lines.map((line, index) => {
        const prefix = Array.isArray(prefixes) ? prefixes[Math.min(index, prefixes.length - 1)] : prefixes(index);
        return `${prefix}${line}`;
      });
      const replacement = prefixedLines.join("\n");
      const nextValue = `${value.slice(0, blockStart)}${replacement}${value.slice(blockEnd)}`;
      updateValue(nextValue, blockStart, blockStart + replacement.length);
    },
    insertText: (text) => {
      const textarea = rootRef.current?.querySelector("textarea");
      if (!textarea) {
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
      const caret = start + text.length;
      updateValue(nextValue, caret, caret);
    },
  };

  return (
    <div ref={rootRef} className="markdown-editor">
      <Space wrap className="markdown-editor__toolbar">
        {TOOLBAR_ACTIONS.map((action) => (
          <Button key={action.key} type="default" size="small" title={action.title} onClick={() => action.onClick(helpers)}>
            {action.label}
          </Button>
        ))}
      </Space>
      <div className="markdown-editor__layout">
        <div className="markdown-editor__pane">
          <label className="markdown-editor__label" htmlFor={editorId}>
            Редактор
          </label>
          <textarea
            id={editorId}
            className="markdown-editor__input ant-input"
            rows={rows}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange?.(event.target.value)}
          />
        </div>
        <div className="markdown-editor__pane">
          <Typography.Text className="markdown-editor__label">Предпросмотр</Typography.Text>
          <div className="markdown-preview markdown-preview--panel">
            {value.trim() ? <MarkdownPreview content={value} /> : <Typography.Text type="secondary">Пустой текст.</Typography.Text>}
          </div>
        </div>
      </div>
      <Typography.Text type="secondary">
        Поддерживаются абзацы, заголовки `H1-H3`, жирный, курсив, цитаты, маркированные и нумерованные списки.
      </Typography.Text>
    </div>
  );
}

export function MarkdownPreview({ content }: { content: string }) {
  const blocks = parseMarkdown(content);
  return <>{blocks.length > 0 ? renderBlocks(blocks) : null}</>;
}

function renderBlocks(blocks: MarkdownBlock[]) {
  return blocks.map((block, index) => {
    if (block.kind === "paragraph") {
      return (
        <p key={`paragraph-${index}`} className="markdown-preview__paragraph">
          {renderInlineTokens(block.tokens)}
        </p>
      );
    }
    if (block.kind === "heading") {
      const Tag = block.kind === "heading" ? (`h${block.level}` as const) : "h3";
      return (
        <Tag key={`heading-${index}`} className={`markdown-preview__heading markdown-preview__heading--${block.level}`}>
          {renderInlineTokens(block.tokens)}
        </Tag>
      );
    }
    if (block.kind === "blockquote") {
      return (
        <blockquote key={`quote-${index}`} className="markdown-preview__quote">
          {renderInlineTokens(block.tokens)}
        </blockquote>
      );
    }
    if (block.kind === "unordered-list") {
      return (
        <ul key={`unordered-${index}`} className="markdown-preview__list">
          {block.items.map((item, itemIndex) => (
            <li key={`unordered-item-${index}-${itemIndex}`}>{renderInlineTokens(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <ol key={`ordered-${index}`} className="markdown-preview__list">
        {block.items.map((item, itemIndex) => (
          <li key={`ordered-item-${index}-${itemIndex}`}>{renderInlineTokens(item)}</li>
        ))}
      </ol>
    );
  });
}

function renderInlineTokens(tokens: InlineToken[]): ReactNode[] {
  return tokens.map((token, index) => {
    if (token.kind === "text") {
      return <Fragment key={`text-${index}`}>{token.text}</Fragment>;
    }
    if (token.kind === "bold") {
      return <strong key={`bold-${index}`}>{renderInlineTokens(token.children)}</strong>;
    }
    if (token.kind === "italic") {
      return <em key={`italic-${index}`}>{renderInlineTokens(token.children)}</em>;
    }
    return <code key={`code-${index}`}>{token.text}</code>;
  });
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        tokens: parseInline(headingMatch[2].trim()),
      });
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^\s*>\s?/, "").trim());
        index += 1;
      }
      blocks.push({ kind: "blockquote", tokens: parseInline(quoteLines.join(" ")) });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: InlineToken[][] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push(parseInline((lines[index] ?? "").replace(/^\s*[-*]\s+/, "").trim()));
        index += 1;
      }
      blocks.push({ kind: "unordered-list", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: InlineToken[][] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? "")) {
        items.push(parseInline((lines[index] ?? "").replace(/^\s*\d+\.\s+/, "").trim()));
        index += 1;
      }
      blocks.push({ kind: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const nextLine = (lines[index] ?? "").trimEnd();
      if (!nextLine.trim() || isBlockBoundary(nextLine)) {
        break;
      }
      paragraphLines.push(nextLine.trim());
      index += 1;
    }
    blocks.push({ kind: "paragraph", tokens: parseInline(paragraphLines.join(" ")) });
  }

  return blocks;
}

function isBlockBoundary(line: string) {
  return /^(#{1,3})\s+/.test(line) || /^\s*>\s?/.test(line) || /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    if (text.startsWith("**", cursor)) {
      const closing = text.indexOf("**", cursor + 2);
      if (closing > cursor + 2) {
        tokens.push({ kind: "bold", children: parseInline(text.slice(cursor + 2, closing)) });
        cursor = closing + 2;
        continue;
      }
    }

    if (text.startsWith("*", cursor)) {
      const closing = text.indexOf("*", cursor + 1);
      if (closing > cursor + 1) {
        tokens.push({ kind: "italic", children: parseInline(text.slice(cursor + 1, closing)) });
        cursor = closing + 1;
        continue;
      }
    }

    if (text.startsWith("`", cursor)) {
      const closing = text.indexOf("`", cursor + 1);
      if (closing > cursor + 1) {
        tokens.push({ kind: "code", text: text.slice(cursor + 1, closing) });
        cursor = closing + 1;
        continue;
      }
    }

    const nextTokenIndex = findNextInlineMarker(text, cursor);
    tokens.push({ kind: "text", text: text.slice(cursor, nextTokenIndex) });
    cursor = nextTokenIndex;
  }

  return tokens.filter((token) => token.kind !== "text" || token.text.length > 0);
}

function findNextInlineMarker(text: string, cursor: number) {
  const candidates = [
    text.indexOf("**", cursor),
    text.indexOf("*", cursor),
    text.indexOf("`", cursor),
  ].filter((index) => index >= 0);

  if (candidates.length === 0) {
    return text.length;
  }

  return Math.min(...candidates);
}
