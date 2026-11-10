import type { AstItem } from "../types";
import { buildParsedMermaid, lineSpan, makeItemId, normalizeMermaidId, tokenSpan } from "./shared";

const classPattern = /^\s*class\s+([A-Za-z][\w-]*)/;
const relationPattern = /^\s*([A-Za-z][\w-]*)\s+(?:["'][^"']+["']\s*)?[-.o*<>|]+(?:\s*:\s*([^:]+))?\s+(?:["'][^"']+["']\s*)?([A-Za-z][\w-]*)/;

export function scanClassDiagram(code: string) {
  const lines = code.split(/\r?\n/);
  const items: AstItem[] = [];
  const classIds = new Set<string>();

  function addClass(lineNumber: number, line: string, classId: string, startIndex: number) {
    const normalizedId = normalizeMermaidId(classId);
    if (classIds.has(normalizedId)) {
      return;
    }
    classIds.add(normalizedId);
    items.push({
      id: makeItemId("classDiagram", "class", [normalizedId]),
      kind: "class",
      diagramType: "classDiagram",
      label: normalizedId,
      sourceId: normalizedId,
      sourceSpan: tokenSpan(lineNumber, startIndex, classId),
      svgHints: [normalizedId],
      editable: true
    });
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const classMatch = line.match(classPattern);
    if (classMatch) {
      addClass(lineNumber, line, classMatch[1], line.indexOf(classMatch[1]));
    }

    const relationMatch = line.match(relationPattern);
    if (relationMatch) {
      const sourceId = normalizeMermaidId(relationMatch[1]);
      const targetId = normalizeMermaidId(relationMatch[3]);
      addClass(lineNumber, line, sourceId, line.indexOf(relationMatch[1]));
      addClass(lineNumber, line, targetId, line.lastIndexOf(relationMatch[3]));
      items.push({
        id: makeItemId("classDiagram", "edge", [sourceId, targetId, lineNumber]),
        kind: "edge",
        diagramType: "classDiagram",
        label: relationMatch[2]?.trim() ?? "",
        sourceId,
        targetId,
        sourceSpan: lineSpan(lineNumber, line),
        svgHints: [sourceId, targetId, relationMatch[2]?.trim() ?? ""].filter(Boolean),
        editable: true
      });
    }
  });

  return buildParsedMermaid("classDiagram", items);
}

