import type { FlowchartShape } from "../ast";

export type VisualSnippetKind = "node" | "edge";

export interface VisualSnippet {
  id: string;
  label: string;
  kind: VisualSnippetKind;
  shape?: FlowchartShape;
  edgeLabel?: string;
  glyph: string;
}

export const visualSnippets: VisualSnippet[] = [
  { id: "node-rectangle", label: "Rectangle", kind: "node", shape: "rectangle", glyph: "[]" },
  { id: "node-rounded", label: "Rounded", kind: "node", shape: "rounded", glyph: "()" },
  { id: "node-stadium", label: "Stadium", kind: "node", shape: "stadium", glyph: "([])" },
  { id: "node-subroutine", label: "Subroutine", kind: "node", shape: "subroutine", glyph: "[[]]" },
  { id: "node-database", label: "Database", kind: "node", shape: "database", glyph: "[()]" },
  { id: "node-decision", label: "Decision", kind: "node", shape: "decision", glyph: "{}" },
  { id: "node-circle", label: "Circle", kind: "node", shape: "circle", glyph: "(())" },
  { id: "node-hexagon", label: "Hexagon", kind: "node", shape: "hexagon", glyph: "{{}}" },
  { id: "edge-basic", label: "Arrow edge", kind: "edge", glyph: "->" },
  { id: "edge-labeled", label: "Labeled edge", kind: "edge", edgeLabel: "label", glyph: "|x|" }
];
