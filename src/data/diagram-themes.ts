export type DiagramTheme = "auto" | "default" | "dark" | "forest" | "neutral" | "base";

export const diagramThemes: Array<{ id: DiagramTheme; label: string; swatch: string }> = [
  { id: "auto", label: "Auto", swatch: "linear-gradient(135deg, #111827 50%, #f8fafc 50%)" },
  { id: "default", label: "Default", swatch: "#dbeafe" },
  { id: "forest", label: "Forest", swatch: "#d9f99d" },
  { id: "neutral", label: "Neutral", swatch: "#e5e7eb" },
  { id: "dark", label: "Dark", swatch: "#111827" },
  { id: "base", label: "Base", swatch: "#fde68a" }
];

