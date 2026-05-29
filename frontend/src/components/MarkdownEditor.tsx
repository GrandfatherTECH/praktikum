import { Button, Space, Typography } from "antd";
import { useDeferredValue, useId, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  prefixLines: (prefix: string | ((index: number) => string)) => void;
  insertText: (text: string) => void;
};

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { key: "bold", label: "Ж", title: "Жирный", onClick: ({ wrapSelection }) => wrapSelection("**", "**", "жирный текст") },
  { key: "italic", label: "К", title: "Курсив", onClick: ({ wrapSelection }) => wrapSelection("*", "*", "курсив") },
  { key: "code", label: "</>", title: "Моноширинный фрагмент", onClick: ({ wrapSelection }) => wrapSelection("`", "`", "код") },
  { key: "heading-1", label: "H1", title: "Заголовок 1", onClick: ({ prefixLines }) => prefixLines("# ") },
  { key: "heading-2", label: "H2", title: "Заголовок 2", onClick: ({ prefixLines }) => prefixLines("## ") },
  { key: "heading-3", label: "H3", title: "Заголовок 3", onClick: ({ prefixLines }) => prefixLines("### ") },
  { key: "bullet-list", label: "•", title: "Маркированный список", onClick: ({ prefixLines }) => prefixLines("- ") },
  { key: "numbered-list", label: "1.", title: "Нумерованный список", onClick: ({ prefixLines }) => prefixLines((index) => `${index + 1}. `) },
  { key: "quote", label: '"', title: "Цитата", onClick: ({ prefixLines }) => prefixLines("> ") },
  { key: "paragraph", label: "¶", title: "Новый абзац", onClick: ({ insertText }) => insertText("\n\n") },
];

export function MarkdownEditor({ value = "", onChange, placeholder, rows = 10 }: MarkdownEditorProps) {
  const editorId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const deferredValue = useDeferredValue(value);

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
    prefixLines: (prefix) => {
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
      const replacement = lines
        .map((line, index) => `${typeof prefix === "string" ? prefix : prefix(index)}${line}`)
        .join("\n");
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
            {deferredValue.trim() ? <MarkdownPreview content={deferredValue} /> : <Typography.Text type="secondary">Пустой текст.</Typography.Text>}
          </div>
        </div>
      </div>
      <Typography.Text type="secondary">
        Поддерживаются стандартные возможности Markdown: абзацы, заголовки, жирный, курсив, цитаты и списки.
      </Typography.Text>
    </div>
  );
}

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="markdown-preview__paragraph">{children}</p>,
          h1: ({ children }) => <h1 className="markdown-preview__heading markdown-preview__heading--1">{children}</h1>,
          h2: ({ children }) => <h2 className="markdown-preview__heading markdown-preview__heading--2">{children}</h2>,
          h3: ({ children }) => <h3 className="markdown-preview__heading markdown-preview__heading--3">{children}</h3>,
          blockquote: ({ children }) => <blockquote className="markdown-preview__quote">{children}</blockquote>,
          ul: ({ children }) => <ul className="markdown-preview__list">{children}</ul>,
          ol: ({ children }) => <ol className="markdown-preview__list">{children}</ol>,
          code: (props) =>
            props.node?.position?.start.line === props.node?.position?.end.line ? (
              <code>{props.children}</code>
            ) : (
              <pre className="markdown-preview__pre">
                <code>{props.children}</code>
              </pre>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
