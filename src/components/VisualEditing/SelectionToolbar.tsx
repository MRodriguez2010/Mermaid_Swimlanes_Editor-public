import { Copy, Link2, Palette, PenLine, Shapes, Trash2, Type } from "lucide-react";
import type { AstItem, FlowchartShape } from "../../ast";

interface SelectionToolbarProps {
  item: AstItem | null;
  connectFromId: string | null;
  onRename: () => void;
  onConnect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onShapeChange: (shape: FlowchartShape) => void;
  onColorChange: (color: string) => void;
}

const shapeOptions: Array<{ shape: FlowchartShape; label: string }> = [
  { shape: "rectangle", label: "Rect" },
  { shape: "rounded", label: "Round" },
  { shape: "decision", label: "Decision" },
  { shape: "database", label: "DB" }
];

const colors = ["#d9f99d", "#bae6fd", "#ddd6fe", "#fecaca", "#fde68a"];

export function SelectionToolbar({
  item,
  connectFromId,
  onRename,
  onConnect,
  onDuplicate,
  onDelete,
  onShapeChange,
  onColorChange
}: SelectionToolbarProps) {
  if (!item) {
    return null;
  }

  const isNode = item.kind !== "edge";

  return (
    <div className="selection-toolbar" aria-label="Selection options">
      <button type="button" title={isNode ? "Rename node" : "Edit edge label"} onClick={onRename}>
        {isNode ? <PenLine size={16} /> : <Type size={16} />}
      </button>
      {isNode ? (
        <>
          <span className="toolbar-divider" />
          <div className="toolbar-menu">
            <button type="button" title="Shape">
              <Shapes size={16} />
            </button>
            <div className="toolbar-popover toolbar-popover--wide">
              {shapeOptions.map((option) => (
                <button key={option.shape} type="button" onClick={() => onShapeChange(option.shape)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar-menu">
            <button type="button" title="Fill color">
              <Palette size={16} />
            </button>
            <div className="toolbar-popover toolbar-popover--colors">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={`Set color ${color}`}
                  style={{ backgroundColor: color }}
                  onClick={() => onColorChange(color)}
                />
              ))}
            </div>
          </div>
          <button type="button" className={connectFromId === item.id ? "is-active" : ""} title="Connect to another node" onClick={onConnect}>
            <Link2 size={16} />
          </button>
          <button type="button" title="Duplicate" onClick={onDuplicate}>
            <Copy size={16} />
          </button>
        </>
      ) : null}
      <span className="toolbar-divider" />
      <button type="button" title="Delete" onClick={onDelete}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

