import type { AstItem } from "../types";
import { buildParsedMermaid, lineSpan, makeItemId, normalizeMermaidId, tokenSpan } from "./shared";

const entityPattern = /^\s*([A-Z][A-Z0-9_]*)\s*\{/;
const relationPattern = /^\s*([A-Z][A-Z0-9_]*)\s+[|o}{\][\w.-]+\s+([A-Z][A-Z0-9_]*)(?:\s*:\s*(.+))?/;

export function scanErDiagram(code: string) {
  const lines = code.split(/\r?\n/);
  const items: AstItem[] = [];
  const entities = new Set<string>();

  function addEntity(lineNumber: number, line: string, entityId: string, startIndex: number) {
    const normalizedId = normalizeMermaidId(entityId);
    if (entities.has(normalizedId)) {
      return;
    }
    entities.add(normalizedId);
    items.push({
      id: makeItemId("erDiagram", "entity", [normalizedId]),
      kind: "entity",
      diagramType: "erDiagram",
      label: normalizedId,
      sourceId: normalizedId,
      sourceSpan: tokenSpan(lineNumber, startIndex, entityId),
      svgHints: [normalizedId],
      editable: true
    });
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const entityMatch = line.match(entityPattern);
    if (entityMatch) {
      addEntity(lineNumber, line, entityMatch[1], line.indexOf(entityMatch[1]));
    }

    const relationMatch = line.match(relationPattern);
    if (!relationMatch) {
      return;
    }

    const sourceId = normalizeMermaidId(relationMatch[1]);
    const targetId = normalizeMermaidId(relationMatch[2]);
    addEntity(lineNumber, line, sourceId, line.indexOf(relationMatch[1]));
    addEntity(lineNumber, line, targetId, line.lastIndexOf(relationMatch[2]));
    items.push({
      id: makeItemId("erDiagram", "edge", [sourceId, targetId, lineNumber]),
      kind: "edge",
      diagramType: "erDiagram",
      label: relationMatch[3]?.trim() ?? "",
      sourceId,
      targetId,
      sourceSpan: lineSpan(lineNumber, line),
      svgHints: [sourceId, targetId, relationMatch[3]?.trim() ?? ""].filter(Boolean),
      editable: true
    });
  });

  return buildParsedMermaid("erDiagram", items);
}

