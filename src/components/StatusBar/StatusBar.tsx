import { useDocumentStore } from "../../store/document";

interface StatusBarProps {
  cursorPosition: {
    line: number;
    column: number;
  };
  snapshotCount: number;
  snapshotStatus: string;
}

export function StatusBar({ cursorPosition, snapshotCount, snapshotStatus }: StatusBarProps) {
  const diagramType = useDocumentStore((state) => state.diagramType);
  const modified = useDocumentStore((state) => state.modified);
  const renderStatus = useDocumentStore((state) => state.renderStatus);
  const filePath = useDocumentStore((state) => state.filePath);

  return (
    <footer className="status-bar">
      <span>
        Ln {cursorPosition.line}, Col {cursorPosition.column}
      </span>
      <span>{filePath ?? "Unsaved"}</span>
      <span>{diagramType ?? "Unknown"}</span>
      <span>{modified ? "Modified" : "Saved"}</span>
      <span>{renderStatus}</span>
      <span title={snapshotStatus}>{snapshotCount ? snapshotStatus : "Snap -"}</span>
    </footer>
  );
}
