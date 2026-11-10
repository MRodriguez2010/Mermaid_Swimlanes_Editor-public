import type { AstItem, ParsedMermaid, SourceSpan } from "../types";

export function emptyParsedMermaid(diagramType: string | null, warnings: string[] = []): ParsedMermaid {
  return {
    diagramType,
    editable: false,
    items: [],
    sourceMap: {},
    lineMap: {},
    warnings
  };
}

export function buildParsedMermaid(diagramType: string, items: AstItem[], warnings: string[] = []): ParsedMermaid {
  const sourceMap: Record<string, SourceSpan> = {};
  const lineMap: Record<number, string[]> = {};

  for (const item of items) {
    sourceMap[item.id] = item.sourceSpan;
    lineMap[item.sourceSpan.line] = [...(lineMap[item.sourceSpan.line] ?? []), item.id];
  }

  return {
    diagramType,
    editable: items.some((item) => item.editable),
    items,
    sourceMap,
    lineMap,
    warnings
  };
}

export function lineSpan(lineNumber: number, line: string): SourceSpan {
  return {
    line: lineNumber,
    startCol: line.search(/\S/) + 1 || 1,
    endCol: line.length + 1
  };
}

export function tokenSpan(lineNumber: number, startIndex: number, token: string): SourceSpan {
  return {
    line: lineNumber,
    startCol: startIndex + 1,
    endCol: startIndex + token.length + 1
  };
}

export function normalizeMermaidId(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function makeItemId(diagramType: string, kind: string, parts: Array<string | number>) {
  return [diagramType, kind, ...parts].map((part) => String(part).replace(/\s+/g, "_")).join(":");
}

export function stripMermaidLabelWrapper(value: string) {
  const wrappers = [
    ["[[", "]]"],
    ["((", "))"],
    ["[(", ")]"],
    ["[", "]"],
    ["(", ")"],
    ["{", "}"]
  ] as const;

  for (const [open, close] of wrappers) {
    if (value.startsWith(open) && value.endsWith(close)) {
      return {
        label: value.slice(open.length, -close.length),
        prefixLength: open.length,
        suffixLength: close.length
      };
    }
  }

  return {
    label: value,
    prefixLength: 0,
    suffixLength: 0
  };
}

