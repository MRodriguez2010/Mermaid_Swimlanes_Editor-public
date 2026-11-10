import {
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import mermaid from "mermaid";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  GitBranch,
  Maximize2,
  Minimize2,
  Move,
  Palette,
  Plus,
  RotateCcw,
  Scan,
  Type,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import type { AstItem, FlowchartDirection, LayoutHints, ParsedMermaid } from "../../ast";
import { diagramThemes, type DiagramTheme } from "../../data/diagram-themes";
import { visualSnippets, type VisualSnippet } from "../../data/visual-snippets";
import { useDocumentStore } from "../../store/document";

interface MermaidCanvasProps {
  code: string;
  theme: "dark" | "light";
  diagramTheme: DiagramTheme;
  layoutHints: LayoutHints;
  ast: ParsedMermaid;
  selectedAstId: string | null;
  selectionEnabled: boolean;
  connectFromId: string | null;
  onDiagramThemeChange: (theme: DiagramTheme) => void;
  onDirectionChange: (direction: FlowchartDirection) => void;
  onDropSnippet: (snippet: VisualSnippet, dropPoint?: { x: number; y: number }) => void;
  onMoveNode: (itemId: string, dx: number, dy: number) => void;
  onSelectAstItem: (itemId: string) => void;
}

let renderCount = 0;

function initializeMermaid(theme: "dark" | "light", diagramTheme: DiagramTheme) {
  const mermaidTheme = diagramTheme === "auto" ? (theme === "dark" ? "dark" : "default") : diagramTheme;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: mermaidTheme
  });
}

function normalizeSvgValue(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function scoreSvgElementForItem(element: Element, item: AstItem) {
  const elementId = normalizeSvgValue(element.id);
  const className =
    typeof element.getAttribute("class") === "string" ? normalizeSvgValue(element.getAttribute("class")) : "";
  const text = normalizeSvgValue(element.textContent);
  const sourceId = normalizeSvgValue(item.sourceId);
  const targetId = normalizeSvgValue(item.targetId);
  const label = normalizeSvgValue(item.label);

  let score = 0;
  if (item.kind === "edge") {
    if (sourceId && targetId && elementId.includes(sourceId) && elementId.includes(targetId)) {
      score += 10;
    }
    if (label && text.includes(label)) {
      score += 5;
    }
    if (className.includes("edge")) {
      score += 2;
    }
  } else {
    if (sourceId && (elementId.includes(`-${sourceId}-`) || elementId.endsWith(`-${sourceId}`))) {
      score += 10;
    }
    if (label && text.includes(label)) {
      score += 6;
    }
    if (className.includes("node") || className.includes("actor") || className.includes("class") || className.includes("entity")) {
      score += 2;
    }
  }

  for (const hint of item.svgHints) {
    const normalizedHint = normalizeSvgValue(hint);
    if (normalizedHint.length >= 3 && (elementId.includes(normalizedHint) || text.includes(normalizedHint))) {
      score += 2;
    }
  }

  return score;
}

function findSvgElementsForItem(host: HTMLElement, item: AstItem) {
  const candidates = [...host.querySelectorAll("g, path, rect, polygon, circle, ellipse, text")];
  const scored = candidates
    .map((element) => ({ element, score: scoreSvgElementForItem(element, item) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const bestScore = scored[0]?.score ?? 0;
  if (!bestScore) {
    return [];
  }

  return scored.filter((candidate) => candidate.score === bestScore).slice(0, 3).map((candidate) => candidate.element);
}

function findAstIdAtPoint(host: HTMLElement | null, x: number, y: number) {
  if (!host) {
    return null;
  }

  const tolerance = 6;
  const hits = [...host.querySelectorAll("[data-ast-id]")]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        id: element.getAttribute("data-ast-id"),
        area: Math.max(1, rect.width * rect.height),
        contains:
          x >= rect.left - tolerance &&
          x <= rect.right + tolerance &&
          y >= rect.top - tolerance &&
          y <= rect.bottom + tolerance
      };
    })
    .filter((hit): hit is { id: string; area: number; contains: true } => Boolean(hit.id && hit.contains))
    .sort((left, right) => left.area - right.area);

  return hits[0]?.id ?? null;
}

function applySvgTransform(element: Element, dx: number, dy: number) {
  const baseTransform = element.getAttribute("data-base-transform") ?? element.getAttribute("transform") ?? "";
  element.setAttribute("data-base-transform", baseTransform);
  element.setAttribute("transform", `${baseTransform} translate(${Math.round(dx)}, ${Math.round(dy)})`.trim());
}

export function MermaidCanvas({
  code,
  theme,
  diagramTheme,
  layoutHints,
  ast,
  selectedAstId,
  selectionEnabled,
  connectFromId,
  onDiagramThemeChange,
  onDirectionChange,
  onDropSnippet,
  onMoveNode,
  onSelectAstItem
}: MermaidCanvasProps) {
  const renderToken = useRef(0);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const nodeDragStateRef = useRef<{
    pointerId: number;
    itemId: string;
    sourceId: string;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [directionMenuOpen, setDirectionMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"Hierarchical" | "Adaptive">("Hierarchical");
  const lastGoodSvg = useDocumentStore((state) => state.lastGoodSvg);
  const renderStatus = useDocumentStore((state) => state.renderStatus);
  const renderError = useDocumentStore((state) => state.renderError);
  const markRenderStart = useDocumentStore((state) => state.markRenderStart);
  const markRenderSuccess = useDocumentStore((state) => state.markRenderSuccess);
  const markRenderError = useDocumentStore((state) => state.markRenderError);

  useEffect(() => {
    initializeMermaid(theme, diagramTheme);
    const token = ++renderToken.current;
    const timeoutId = window.setTimeout(async () => {
      if (!code.trim()) {
        markRenderError("Document is empty.");
        return;
      }

      markRenderStart();
      try {
        const renderId = `mermaid-local-${++renderCount}`;
        const { svg } = await mermaid.render(renderId, code);
        if (token === renderToken.current) {
          markRenderSuccess(svg);
        }
      } catch (error) {
        if (token === renderToken.current) {
          markRenderError(error instanceof Error ? error.message : String(error));
        }
      }
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [code, diagramTheme, markRenderError, markRenderStart, markRenderSuccess, theme]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) {
      return;
    }

    host.querySelectorAll("[data-ast-id]").forEach((element) => {
      element.removeAttribute("data-ast-id");
      element.classList.remove("svg-ast-hit", "svg-ast-selected");
    });

    if (!selectionEnabled) {
      return;
    }

    for (const item of ast.items) {
      for (const element of findSvgElementsForItem(host, item)) {
        element.setAttribute("data-ast-id", item.id);
        element.classList.add("svg-ast-hit");
        if (item.kind !== "edge" && item.sourceId && layoutHints[item.sourceId]) {
          applySvgTransform(element, layoutHints[item.sourceId][0], layoutHints[item.sourceId][1]);
        }
        if (item.id === selectedAstId) {
          element.classList.add("svg-ast-selected");
        }
      }
    }
  }, [ast, lastGoodSvg, layoutHints, selectedAstId, selectionEnabled]);

  const canvasClass = useMemo(
    () =>
      [
        "canvas-surface",
        renderStatus === "error" ? "canvas-surface--error" : "",
        isPanning ? "canvas-surface--panning" : ""
      ]
        .filter(Boolean)
        .join(" "),
    [isPanning, renderStatus]
  );

  const zoomBy = useCallback((factor: number) => {
    setZoom((currentZoom) => Math.min(20, Math.max(0.05, Number((currentZoom * factor).toFixed(3)))));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitToScreen = useCallback(() => {
    const surface = surfaceRef.current;
    const svg = svgHostRef.current?.querySelector("svg");
    if (!surface || !svg) {
      resetView();
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) {
      resetView();
      return;
    }

    const widthScale = (surfaceRect.width * 0.9) / (svgRect.width / zoom);
    const heightScale = (surfaceRect.height * 0.9) / (svgRect.height / zoom);
    const nextZoom = Math.min(20, Math.max(0.05, Math.min(widthScale, heightScale)));
    setZoom(Number(nextZoom.toFixed(3)));
    setPan({ x: 0, y: 0 });
  }, [resetView, zoom]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
        return;
      }

      await shellRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } catch {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.button !== 1) {
        return;
      }

      const astId = selectionEnabled ? findAstIdAtPoint(svgHostRef.current, event.clientX, event.clientY) : null;
      const item = ast.items.find((candidate) => candidate.id === astId);
      if (item) {
        event.preventDefault();
        event.stopPropagation();
        onSelectAstItem(item.id);
        if (item.kind !== "edge" && item.sourceId) {
          const hint = layoutHints[item.sourceId] ?? [0, 0];
          nodeDragStateRef.current = {
            pointerId: event.pointerId,
            itemId: item.id,
            sourceId: item.sourceId,
            startX: event.clientX,
            startY: event.clientY,
            baseX: hint[0],
            baseY: hint[1],
            moved: false
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        return;
      }

      event.preventDefault();
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: pan.x,
        originY: pan.y
      };
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [ast.items, layoutHints, onSelectAstItem, pan.x, pan.y, selectionEnabled]
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const nodeDragState = nodeDragStateRef.current;
    const host = svgHostRef.current;
    if (nodeDragState?.pointerId === event.pointerId && host) {
      const nextX = nodeDragState.baseX + (event.clientX - nodeDragState.startX) / zoom;
      const nextY = nodeDragState.baseY + (event.clientY - nodeDragState.startY) / zoom;
      nodeDragState.moved =
        nodeDragState.moved ||
        Math.abs(event.clientX - nodeDragState.startX) > 3 ||
        Math.abs(event.clientY - nodeDragState.startY) > 3;
      host.querySelectorAll(`[data-ast-id="${CSS.escape(nodeDragState.itemId)}"]`).forEach((element) => {
        applySvgTransform(element, nextX, nextY);
      });
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setPan({
      x: dragState.originX + event.clientX - dragState.startX,
      y: dragState.originY + event.clientY - dragState.startY
    });
  }, [zoom]);

  const finishPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const nodeDragState = nodeDragStateRef.current;
    if (nodeDragState?.pointerId === event.pointerId) {
      nodeDragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const nextX = nodeDragState.baseX + (event.clientX - nodeDragState.startX) / zoom;
      const nextY = nodeDragState.baseY + (event.clientY - nodeDragState.startY) / zoom;
      if (nodeDragState.moved) {
        onMoveNode(nodeDragState.itemId, nextX, nextY);
      }
      return;
    }

    const dragState = dragStateRef.current;
    if (dragState?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setIsPanning(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [onMoveNode, zoom]);

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      zoomBy(event.deltaY > 0 ? 0.9 : 1.1);
      return;
    }

    setPan((currentPan) => ({
      x: currentPan.x - event.deltaX,
      y: currentPan.y - event.deltaY
    }));
  }, [zoomBy]);

  const handleSvgClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!selectionEnabled) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const selectedElement = target?.closest("[data-ast-id]");
      const astId = selectedElement?.getAttribute("data-ast-id");
      if (!astId) {
        return;
      }

      event.stopPropagation();
      onSelectAstItem(astId);
    },
    [onSelectAstItem, selectionEnabled]
  );

  const handleSvgPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!selectionEnabled || event.button !== 0) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const selectedElement = target?.closest("[data-ast-id]");
      const astId = selectedElement?.getAttribute("data-ast-id");
      const item = ast.items.find((candidate) => candidate.id === astId);
      if (!item?.sourceId || item.kind === "edge") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectAstItem(item.id);
      const hint = layoutHints[item.sourceId] ?? [0, 0];
      nodeDragStateRef.current = {
        pointerId: event.pointerId,
        itemId: item.id,
        sourceId: item.sourceId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: hint[0],
        baseY: hint[1],
        moved: false
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [ast.items, layoutHints, onSelectAstItem, selectionEnabled]
  );

  const handleSvgPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = nodeDragStateRef.current;
      const host = svgHostRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId || !host) {
        return;
      }

      const nextX = dragState.baseX + (event.clientX - dragState.startX) / zoom;
      const nextY = dragState.baseY + (event.clientY - dragState.startY) / zoom;
      dragState.moved = dragState.moved || Math.abs(event.clientX - dragState.startX) > 3 || Math.abs(event.clientY - dragState.startY) > 3;
      host.querySelectorAll(`[data-ast-id="${CSS.escape(dragState.itemId)}"]`).forEach((element) => {
        applySvgTransform(element, nextX, nextY);
      });
    },
    [zoom]
  );

  const handleSvgPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = nodeDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      nodeDragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const nextX = dragState.baseX + (event.clientX - dragState.startX) / zoom;
      const nextY = dragState.baseY + (event.clientY - dragState.startY) / zoom;
      if (dragState.moved) {
        onMoveNode(dragState.itemId, nextX, nextY);
      }
    },
    [onMoveNode, zoom]
  );

  const handleSvgMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!selectionEnabled || event.button !== 0 || nodeDragStateRef.current) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const selectedElement = target?.closest("[data-ast-id]");
      const astId = selectedElement?.getAttribute("data-ast-id");
      const item = ast.items.find((candidate) => candidate.id === astId);
      if (!item?.sourceId || item.kind === "edge") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectAstItem(item.id);
      const hint = layoutHints[item.sourceId] ?? [0, 0];
      nodeDragStateRef.current = {
        pointerId: -1,
        itemId: item.id,
        sourceId: item.sourceId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: hint[0],
        baseY: hint[1],
        moved: false
      };
    },
    [ast.items, layoutHints, onSelectAstItem, selectionEnabled]
  );

  const handleSvgMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const dragState = nodeDragStateRef.current;
      const host = svgHostRef.current;
      if (!dragState || dragState.pointerId !== -1 || !host) {
        return;
      }

      const nextX = dragState.baseX + (event.clientX - dragState.startX) / zoom;
      const nextY = dragState.baseY + (event.clientY - dragState.startY) / zoom;
      dragState.moved = dragState.moved || Math.abs(event.clientX - dragState.startX) > 3 || Math.abs(event.clientY - dragState.startY) > 3;
      host.querySelectorAll(`[data-ast-id="${CSS.escape(dragState.itemId)}"]`).forEach((element) => {
        applySvgTransform(element, nextX, nextY);
      });
    },
    [zoom]
  );

  const handleSvgMouseUp = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const dragState = nodeDragStateRef.current;
      if (!dragState || dragState.pointerId !== -1) {
        return;
      }

      nodeDragStateRef.current = null;
      const nextX = dragState.baseX + (event.clientX - dragState.startX) / zoom;
      const nextY = dragState.baseY + (event.clientY - dragState.startY) / zoom;
      if (dragState.moved) {
        onMoveNode(dragState.itemId, nextX, nextY);
      }
    },
    [onMoveNode, zoom]
  );

  const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes("application/x-mermaid-snippet")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const rawSnippet = event.dataTransfer.getData("application/x-mermaid-snippet");
      if (!rawSnippet) {
        return;
      }

      event.preventDefault();
      try {
        const surface = surfaceRef.current;
        const surfaceRect = surface?.getBoundingClientRect();
        const dropPoint = surfaceRect
          ? {
              x: Math.round((event.clientX - (surfaceRect.left + surfaceRect.width / 2) - pan.x) / zoom),
              y: Math.round((event.clientY - (surfaceRect.top + surfaceRect.height / 2) - pan.y) / zoom)
            }
          : undefined;
        onDropSnippet(JSON.parse(rawSnippet) as VisualSnippet, dropPoint);
      } catch {
        return;
      }
    },
    [onDropSnippet, pan.x, pan.y, zoom]
  );

  return (
    <div className="canvas-shell" ref={shellRef}>
      <div className="canvas-toolbar" aria-label="Canvas tools">
        <button type="button" className="is-active" title="Pan tool" aria-pressed="true">
          <Move size={16} />
        </button>
        <button type="button" title="Zoom out" onClick={() => zoomBy(0.85)}>
          <ZoomOut size={16} />
        </button>
        <button type="button" title="Fit" onClick={fitToScreen}>
          <Scan size={16} />
        </button>
        <button type="button" title="Zoom in" onClick={() => zoomBy(1.15)}>
          <ZoomIn size={16} />
        </button>
        <button type="button" title="100%" onClick={resetView}>
          <RotateCcw size={16} />
        </button>
        <span className="toolbar-divider" />
        <div className="canvas-tool-menu">
          <button
            type="button"
            className={themeMenuOpen ? "is-active" : ""}
            title="Diagram theme"
            onClick={() => setThemeMenuOpen((currentValue) => !currentValue)}
          >
            <Palette size={16} />
          </button>
          {themeMenuOpen ? (
            <div className="canvas-popover canvas-popover--theme">
              <span>Diagram theme</span>
              <div className="theme-swatch-grid">
                {diagramThemes.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={diagramTheme === option.id ? "is-active" : ""}
                    title={option.label}
                    aria-label={option.label}
                    style={{ background: option.swatch }}
                    onClick={() => {
                      onDiagramThemeChange(option.id);
                      setThemeMenuOpen(false);
                    }}
                  />
                ))}
              </div>
              <span>Diagram style</span>
              <div className="diagram-style-row">
                <button type="button" className="is-active" title="Rounded style" />
                <button type="button" title="Plain style" />
                <button type="button" title="Outline style" />
              </div>
              <span>Diagram font</span>
              <div className="font-row">
                <button type="button" className="is-active">Aa</button>
                <button type="button">Aa</button>
                <button type="button">Aa</button>
              </div>
            </div>
          ) : null}
        </div>
        <button type="button" title="Add rectangle" onClick={() => onDropSnippet(visualSnippets[0])}>
          <Plus size={16} />
        </button>
        <button type="button" title="Add text node" onClick={() => onDropSnippet(visualSnippets[1])}>
          <Type size={16} />
        </button>
        <div className="canvas-tool-menu">
          <button
            type="button"
            className={directionMenuOpen ? "is-active" : ""}
            title="Change direction"
            onClick={() => setDirectionMenuOpen((currentValue) => !currentValue)}
          >
            <ChevronDown size={16} />
          </button>
          {directionMenuOpen ? (
            <div className="canvas-popover canvas-popover--menu">
              <button type="button" onClick={() => onDirectionChange("TB")}>
                <ArrowDown size={16} />
                Top to bottom
              </button>
              <button type="button" onClick={() => onDirectionChange("BT")}>
                <ArrowUp size={16} />
                Bottom to top
              </button>
              <button type="button" onClick={() => onDirectionChange("LR")}>
                <ArrowRight size={16} />
                Left to right
              </button>
              <button type="button" onClick={() => onDirectionChange("RL")}>
                <ArrowLeft size={16} />
                Right to left
              </button>
            </div>
          ) : null}
        </div>
        <div className="canvas-tool-menu">
          <button
            type="button"
            className={layoutMenuOpen ? "is-active" : ""}
            title="Layout"
            onClick={() => setLayoutMenuOpen((currentValue) => !currentValue)}
          >
            <GitBranch size={16} />
          </button>
          {layoutMenuOpen ? (
            <div className="canvas-popover canvas-popover--menu">
              {(["Hierarchical", "Adaptive"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={layoutMode === mode ? "is-active" : ""}
                  onClick={() => {
                    setLayoutMode(mode);
                    setLayoutMenuOpen(false);
                  }}
                >
                  <GitBranch size={16} />
                  {mode}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      <div className="zoom-indicator">{Math.round(zoom * 100)}%</div>
      {renderStatus === "error" && renderError ? <div className="render-error">{renderError}</div> : null}
      <div
        className={canvasClass}
        ref={surfaceRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {lastGoodSvg ? (
          <div
            className="svg-host"
            ref={svgHostRef}
            onClick={handleSvgClick}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
            onMouseDown={handleSvgMouseDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            style={{
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            }}
            dangerouslySetInnerHTML={{ __html: lastGoodSvg }}
          />
        ) : (
          <div className="canvas-empty">No render</div>
        )}
      </div>
    </div>
  );
}
