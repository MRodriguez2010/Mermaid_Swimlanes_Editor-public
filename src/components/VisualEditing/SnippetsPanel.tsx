import { Braces, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { visualSnippets, type VisualSnippet } from "../../data/visual-snippets";

interface SnippetsPanelProps {
  enabled: boolean;
  selectedNodeLabel: string | null;
  onInsertSnippet: (snippet: VisualSnippet) => void;
}

export function SnippetsPanel({ enabled, selectedNodeLabel, onInsertSnippet }: SnippetsPanelProps) {
  const [open, setOpen] = useState(true);

  if (!enabled) {
    return null;
  }

  return (
    <section className={`snippets-panel${open ? "" : " snippets-panel--closed"}`} aria-label="Code snippets">
      <button className="snippets-header" type="button" onClick={() => setOpen((currentValue) => !currentValue)}>
        <span>
          <Braces size={16} />
          Snippets
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      {open ? (
        <div className="snippets-body">
          <div className="snippets-section-label">Flowchart shapes</div>
          <div className="snippet-grid">
            {visualSnippets
              .filter((snippet) => snippet.kind === "node")
              .map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  draggable
                  className="snippet-tile"
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-mermaid-snippet", JSON.stringify(snippet));
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onInsertSnippet(snippet)}
                >
                  <span className="snippet-glyph">{snippet.glyph}</span>
                  <span>{snippet.label}</span>
                </button>
              ))}
          </div>
          <div className="snippets-section-label">Edges</div>
          <div className="snippet-grid">
            {visualSnippets
              .filter((snippet) => snippet.kind === "edge")
              .map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  draggable
                  className="snippet-tile"
                  title={selectedNodeLabel ? `Add from ${selectedNodeLabel}` : "Select a node first"}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-mermaid-snippet", JSON.stringify(snippet));
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onInsertSnippet(snippet)}
                >
                  <span className="snippet-glyph">{snippet.glyph}</span>
                  <span>{snippet.label}</span>
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

