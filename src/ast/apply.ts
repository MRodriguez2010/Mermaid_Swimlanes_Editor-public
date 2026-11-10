import { parse } from "./parse";
import { writeLayoutHint } from "./layoutHints";
import type { FlowchartDirection, FlowchartShape, MermaidPatch, ParsedMermaid, SourceSpan } from "./types";

function replaceSpan(code: string, span: SourceSpan, replacement: string) {
  const lines = code.split(/\r?\n/);
  const lineIndex = span.line - 1;
  const line = lines[lineIndex];
  if (line === undefined) {
    return code;
  }

  lines[lineIndex] = `${line.slice(0, span.startCol - 1)}${replacement}${line.slice(span.endCol - 1)}`;
  return lines.join("\n");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanMermaidId(value: string) {
  const base = value
    .trim()
    .replace(/[^A-Za-z0-9_ -]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[^A-Za-z]+/, "");

  return base.slice(0, 28) || "Node";
}

function existingSourceIds(ast: ParsedMermaid) {
  return new Set(ast.items.map((item) => item.sourceId).filter((sourceId): sourceId is string => Boolean(sourceId)));
}

function uniqueNodeId(ast: ParsedMermaid, label: string, requestedId?: string) {
  const ids = existingSourceIds(ast);
  const base = cleanMermaidId(requestedId || label || "Node");
  if (!ids.has(base)) {
    return base;
  }

  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${base}_${index}`;
    if (!ids.has(candidate)) {
      return candidate;
    }
  }

  return `${base}_${Date.now()}`;
}

function shapeLabel(label: string, shape: FlowchartShape = "rectangle") {
  switch (shape) {
    case "rounded":
      return `(${label})`;
    case "stadium":
      return `([${label}])`;
    case "subroutine":
      return `[[${label}]]`;
    case "database":
      return `[(${label})]`;
    case "decision":
      return `{${label}}`;
    case "circle":
      return `((${label}))`;
    case "hexagon":
      return `{{${label}}}`;
    case "asymmetric":
      return `>${label}]`;
    case "rectangle":
    default:
      return `[${label}]`;
  }
}

function appendFlowchartLine(code: string, line: string) {
  const trimmedEnd = code.replace(/\s+$/, "");
  return `${trimmedEnd}\n  ${line}\n`;
}

function sourceIdFromItem(ast: ParsedMermaid, itemId: string) {
  return ast.items.find((candidate) => candidate.id === itemId)?.sourceId ?? null;
}

function addNode(code: string, ast: ParsedMermaid, label: string, shape?: FlowchartShape, nodeId?: string) {
  const nextId = uniqueNodeId(ast, label, nodeId);
  return appendFlowchartLine(code, `${nextId}${shapeLabel(label, shape)}`);
}

function addEdge(code: string, sourceId: string, targetId: string, label?: string) {
  const edgeLabel = label?.trim() ? `|${label.trim()}|` : "";
  return appendFlowchartLine(code, `${sourceId} -->${edgeLabel} ${targetId}`);
}

function deleteNode(code: string, ast: ParsedMermaid, itemId: string) {
  const sourceId = sourceIdFromItem(ast, itemId);
  if (!sourceId) {
    return code;
  }

  const sourceIdPattern = new RegExp(`\\b${escapeRegExp(sourceId)}\\b`);
  return code
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("flowchart") || trimmed.startsWith("graph") || trimmed.startsWith("%%")) {
        return true;
      }
      return !sourceIdPattern.test(trimmed);
    })
    .join("\n");
}

function deleteEdge(code: string, ast: ParsedMermaid, itemId: string) {
  const item = ast.items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return code;
  }

  return code
    .split(/\r?\n/)
    .filter((_, index) => index !== item.sourceSpan.line - 1)
    .join("\n");
}

function findNodeExpression(line: string, nodeId: string) {
  const escapedId = escapeRegExp(nodeId);
  const expression =
    "(\\[\\[[^\\]]+\\]\\]|\\(\\[[^\\]]+\\]\\)|\\[\\([^)]*\\)\\]|\\(\\([^)]*\\)\\)|\\{\\{[^}]+\\}\\}|\\[[^\\]]+\\]|\\([^)]*\\)|\\{[^}]+\\}|>[^\\]]+\\])";
  return new RegExp(`(${escapedId})\\s*${expression}`);
}

function changeNodeShape(code: string, ast: ParsedMermaid, itemId: string, shape: FlowchartShape) {
  const item = ast.items.find((candidate) => candidate.id === itemId);
  if (!item?.sourceId) {
    return code;
  }

  const lines = code.split(/\r?\n/);
  const lineIndex = item.sourceSpan.line - 1;
  const line = lines[lineIndex];
  if (!line) {
    return code;
  }

  const nodePattern = findNodeExpression(line, item.sourceId);
  lines[lineIndex] = line.replace(nodePattern, `${item.sourceId}${shapeLabel(item.label, shape)}`);
  return lines.join("\n");
}

function recolorNode(code: string, ast: ParsedMermaid, itemId: string, color: string) {
  const sourceId = sourceIdFromItem(ast, itemId);
  if (!sourceId) {
    return code;
  }

  const stylePattern = new RegExp(`^\\s*style\\s+${escapeRegExp(sourceId)}\\b.*$`, "m");
  const nextStyle = `  style ${sourceId} fill:${color},stroke:#1f2937,stroke-width:2px`;
  if (stylePattern.test(code)) {
    return code.replace(stylePattern, nextStyle);
  }

  return appendFlowchartLine(code, nextStyle.trim());
}

function editEdgeLabel(code: string, ast: ParsedMermaid, itemId: string, label: string) {
  const item = ast.items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return code;
  }

  if (item.labelSpan) {
    return replaceSpan(code, item.labelSpan, label);
  }

  const lines = code.split(/\r?\n/);
  const lineIndex = item.sourceSpan.line - 1;
  const line = lines[lineIndex];
  if (!line) {
    return code;
  }

  lines[lineIndex] = line.replace(/([-~=ox.]*[-=.]+[->ox.]+)/, `$1|${label}|`);
  return lines.join("\n");
}

function setDirection(code: string, direction: FlowchartDirection) {
  return code.replace(/^(flowchart|graph)\s+(TB|BT|LR|RL|TD)/m, (_, type) => `${type} ${direction}`);
}

export function applyPatch(code: string, patch: MermaidPatch): string {
  const ast = parse(code);

  if (patch.type === "renameNode") {
    const item = ast.items.find((candidate) => candidate.id === patch.itemId);
    if (!item?.labelSpan) {
      throw new Error("Cannot rename; no editable label span was found.");
    }
    return replaceSpan(code, item.labelSpan, patch.label);
  }

  if (patch.type === "editEdgeLabel") {
    return editEdgeLabel(code, ast, patch.itemId, patch.label);
  }

  if (patch.type === "addNode") {
    return addNode(code, ast, patch.label, patch.shape, patch.nodeId);
  }

  if (patch.type === "addEdge") {
    return addEdge(code, patch.sourceId, patch.targetId, patch.label);
  }

  if (patch.type === "deleteNode") {
    return deleteNode(code, ast, patch.itemId);
  }

  if (patch.type === "deleteEdge") {
    return deleteEdge(code, ast, patch.itemId);
  }

  if (patch.type === "changeNodeShape") {
    return changeNodeShape(code, ast, patch.itemId, patch.shape);
  }

  if (patch.type === "recolorNode") {
    return recolorNode(code, ast, patch.itemId, patch.color);
  }

  if (patch.type === "moveLayoutHint") {
    const sourceId = sourceIdFromItem(ast, patch.itemId);
    if (!sourceId) {
      return code;
    }
    return writeLayoutHint(code, sourceId, patch.dx, patch.dy);
  }

  if (patch.type === "setDirection") {
    return setDirection(code, patch.direction);
  }

  const unknownPatch = patch as { type: string };
  throw new Error(`${unknownPatch.type} is not implemented in the current AST bridge slice.`);
}
