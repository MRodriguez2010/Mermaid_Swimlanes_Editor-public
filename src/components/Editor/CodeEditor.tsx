import Editor, { type OnMount } from "@monaco-editor/react";
import { AlignLeft, BookOpen, Play, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SourceSpan } from "../../ast";
import { registerMermaidLanguage } from "../../lang/mermaid-monarch";

type EditorInstance = Parameters<OnMount>[0];
type MonacoApi = Parameters<OnMount>[1];
type DecorationCollection = ReturnType<EditorInstance["createDecorationsCollection"]>;

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: "dark" | "light";
  autoUpdate: boolean;
  onToggleAutoUpdate: () => void;
  onFormat: () => void;
  onRender: () => void;
  onOpenDocs: () => void;
  editorNotice: string | null;
  onCursorPositionChange: (position: { line: number; column: number }) => void;
  selectedSourceSpan: SourceSpan | null;
  onLineFocus: (line: number) => void;
  onSelectionTextChange: (selectionText: string) => void;
}

export function CodeEditor({
  value,
  onChange,
  theme,
  autoUpdate,
  onToggleAutoUpdate,
  onFormat,
  onRender,
  onOpenDocs,
  editorNotice,
  onCursorPositionChange,
  selectedSourceSpan,
  onLineFocus,
  onSelectionTextChange
}: CodeEditorProps) {
  const editorTheme = theme === "dark" ? "mermaidLocalDark" : "mermaidLocalLight";
  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const decorationsRef = useRef<DecorationCollection | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    decorationsRef.current = editor.createDecorationsCollection();
    registerMermaidLanguage(monaco);
    monaco.editor.setTheme(editorTheme);
    const position = editor.getPosition();
    if (position) {
      onCursorPositionChange({ line: position.lineNumber, column: position.column });
      onLineFocus(position.lineNumber);
    }
    editor.onDidChangeCursorPosition((event) => {
      onCursorPositionChange({ line: event.position.lineNumber, column: event.position.column });
      onLineFocus(event.position.lineNumber);
    });
    editor.onDidChangeCursorSelection((event) => {
      const model = editor.getModel();
      const selectionText = model?.getValueInRange(event.selection) ?? "";
      onSelectionTextChange(selectionText);
    });
    editor.focus();
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const decorations = decorationsRef.current;
    if (!editor || !monaco || !decorations) {
      return;
    }

    if (!selectedSourceSpan) {
      decorations.clear();
      return;
    }

    const range = new monaco.Range(
      selectedSourceSpan.line,
      selectedSourceSpan.startCol,
      selectedSourceSpan.line,
      Math.max(selectedSourceSpan.endCol, selectedSourceSpan.startCol + 1)
    );
    decorations.set([
      {
        range,
        options: {
          isWholeLine: true,
          className: "editor-source-line-highlight",
          glyphMarginClassName: "editor-source-glyph"
        }
      }
    ]);
    editor.revealLineInCenterIfOutsideViewport(selectedSourceSpan.line);
  }, [selectedSourceSpan]);

  return (
    <div className="editor-shell">
      <div className="editor-toolbar" aria-label="Editor tools" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={autoUpdate ? "is-active" : ""}
          aria-pressed={autoUpdate}
          aria-label={autoUpdate ? "Turn auto-update off" : "Turn auto-update on"}
          title={autoUpdate ? "Auto-update on" : "Auto-update off"}
          onClick={onToggleAutoUpdate}
        >
          <RefreshCw size={16} />
        </button>
        <button type="button" title="Render" aria-label="Render diagram" onClick={onRender}>
          <Play size={16} />
        </button>
        <button type="button" title="Format" aria-label="Format code" onClick={onFormat}>
          <AlignLeft size={16} />
        </button>
        <button type="button" title="Mermaid docs" aria-label="Open Mermaid docs" onClick={onOpenDocs}>
          <BookOpen size={16} />
        </button>
      </div>
      {editorNotice ? (
        <output className="editor-toolbar-status" aria-live="polite">
          {editorNotice}
        </output>
      ) : null}
      <Editor
        height="100%"
        language="mermaid"
        theme={editorTheme}
        value={value}
        beforeMount={registerMermaidLanguage}
        onMount={handleMount}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          automaticLayout: true,
          fontSize: 14,
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          lineNumbers: "on",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: "on"
        }}
      />
    </div>
  );
}
