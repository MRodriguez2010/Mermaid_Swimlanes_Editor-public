export type AstItemKind = "node" | "edge" | "participant" | "class" | "entity" | "state";
export type FlowchartShape =
  | "rectangle"
  | "rounded"
  | "stadium"
  | "subroutine"
  | "database"
  | "decision"
  | "circle"
  | "hexagon"
  | "asymmetric";

export type FlowchartDirection = "TB" | "BT" | "LR" | "RL";

export interface SourceSpan {
  line: number;
  startCol: number;
  endCol: number;
}

export interface AstItem {
  id: string;
  kind: AstItemKind;
  diagramType: string;
  label: string;
  sourceId?: string;
  targetId?: string;
  sourceSpan: SourceSpan;
  labelSpan?: SourceSpan;
  svgHints: string[];
  editable: boolean;
}

export interface ParsedMermaid {
  diagramType: string | null;
  editable: boolean;
  items: AstItem[];
  sourceMap: Record<string, SourceSpan>;
  lineMap: Record<number, string[]>;
  warnings: string[];
}

export type MermaidPatch =
  | { type: "renameNode"; itemId: string; label: string }
  | { type: "editEdgeLabel"; itemId: string; label: string }
  | { type: "addNode"; label: string; shape?: FlowchartShape; nodeId?: string }
  | { type: "addEdge"; sourceId: string; targetId: string; label?: string }
  | { type: "deleteNode"; itemId: string }
  | { type: "deleteEdge"; itemId: string }
  | { type: "changeNodeShape"; itemId: string; shape: FlowchartShape }
  | { type: "recolorNode"; itemId: string; color: string }
  | { type: "moveLayoutHint"; itemId: string; dx: number; dy: number }
  | { type: "setDirection"; direction: FlowchartDirection };
