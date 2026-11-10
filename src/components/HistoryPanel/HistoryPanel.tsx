import { Database, RefreshCw, RotateCcw, X } from "lucide-react";
import type { SnapshotMeta } from "../../ipc/snapshots";

interface HistoryPanelProps {
  snapshots: SnapshotMeta[];
  selectedSnapshotId: number | null;
  loading: boolean;
  snapshotStatus: string;
  onClose: () => void;
  onRefresh: () => void;
  onManualSnapshot: () => void;
  onSelectSnapshot: (snapshot: SnapshotMeta) => void;
  onRestoreSnapshot: () => void;
}

function formatSnapshotTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function HistoryPanel({
  snapshots,
  selectedSnapshotId,
  loading,
  snapshotStatus,
  onClose,
  onRefresh,
  onManualSnapshot,
  onSelectSnapshot,
  onRestoreSnapshot
}: HistoryPanelProps) {
  return (
    <aside className="history-panel" aria-label="Snapshot history">
      <div className="history-panel-header">
        <div>
          <h2>History</h2>
          <span>{snapshotStatus}</span>
        </div>
        <div className="history-panel-actions">
          <button type="button" title="Manual snapshot" aria-label="Manual snapshot" onClick={onManualSnapshot}>
            <Database size={15} />
          </button>
          <button type="button" title="Refresh history" aria-label="Refresh history" onClick={onRefresh}>
            <RefreshCw size={15} />
          </button>
          <button type="button" title="Close history" aria-label="Close history" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>
      {selectedSnapshotId ? (
        <button className="history-restore" type="button" onClick={onRestoreSnapshot}>
          <RotateCcw size={15} />
          <span>Restore Selected</span>
        </button>
      ) : null}
      <div className="history-list" aria-busy={loading}>
        {loading ? <div className="history-empty">Loading history</div> : null}
        {!loading && snapshots.length === 0 ? <div className="history-empty">No snapshots yet</div> : null}
        {snapshots.map((snapshot) => (
          <button
            key={snapshot.id}
            type="button"
            className={`history-item${snapshot.id === selectedSnapshotId ? " is-selected" : ""}`}
            onClick={() => onSelectSnapshot(snapshot)}
          >
            <span className="history-item-main">
              <span className="history-time">{formatSnapshotTime(snapshot.createdAt)}</span>
              <span className="history-meta">
                <span className="history-trigger">{snapshot.trigger}</span>
                <span>{snapshot.kind}</span>
                <span>{formatBytes(snapshot.byteSize)}</span>
              </span>
            </span>
            <span className="history-label">{snapshot.label ?? `Snapshot #${snapshot.id}`}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
