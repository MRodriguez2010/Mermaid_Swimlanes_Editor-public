import {
  AlignLeft,
  BookOpen,
  Database,
  File,
  FolderOpen,
  History,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Save,
  SaveAll,
  SlidersHorizontal,
  Sun
} from "lucide-react";
import { useDocumentStore } from "../../store/document";

interface TopBarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onManualSnapshot: () => void;
  onFormat: () => void;
  onRender: () => void;
  onToggleAiPanel: () => void;
  onOpenDocs: () => void;
  onOpenSettings: () => void;
  onToggleHistoryPanel: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  aiCollapsed: boolean;
}

export function TopBar({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onManualSnapshot,
  onFormat,
  onRender,
  onToggleAiPanel,
  onOpenDocs,
  onOpenSettings,
  onToggleHistoryPanel,
  theme,
  onToggleTheme,
  aiCollapsed
}: TopBarProps) {
  const fileName = useDocumentStore((state) => state.fileName);

  return (
    <header className="top-bar">
      <div className="app-title">
        <span className="app-mark">ML</span>
        <span>{fileName}</span>
      </div>
      <nav className="desktop-menu" aria-label="Application commands">
        <div className="menu-group" aria-label="File">
          <span className="menu-group-label">File</span>
          <div className="menu-command-list">
            <button className="menu-command" type="button" onClick={onNew} title="New diagram" aria-label="New diagram">
              <File size={15} />
            </button>
            <button className="menu-command" type="button" onClick={onOpen} title="Open file" aria-label="Open file">
              <FolderOpen size={15} />
            </button>
            <button className="menu-command" type="button" onClick={onSave} title="Save" aria-label="Save">
              <Save size={15} />
            </button>
            <button className="menu-command" type="button" onClick={onSaveAs} title="Save as" aria-label="Save as">
              <SaveAll size={15} />
            </button>
            <button
              className="menu-command"
              type="button"
              onClick={onManualSnapshot}
              title="Manual snapshot"
              aria-label="Manual snapshot"
            >
              <Database size={15} />
            </button>
          </div>
        </div>
        <div className="menu-group" aria-label="Edit">
          <span className="menu-group-label">Edit</span>
          <div className="menu-command-list">
            <button className="menu-command" type="button" onClick={onFormat} title="Format code" aria-label="Format code">
              <AlignLeft size={15} />
            </button>
          </div>
        </div>
        <div className="menu-group" aria-label="View">
          <span className="menu-group-label">View</span>
          <div className="menu-command-list">
            <button
              className="menu-command"
              type="button"
              onClick={onToggleTheme}
              title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              className="menu-command"
              type="button"
              onClick={onToggleHistoryPanel}
              title="History"
              aria-label="History"
            >
              <History size={15} />
            </button>
          </div>
        </div>
        <div className="menu-group" aria-label="Diagram">
          <span className="menu-group-label">Diagram</span>
          <div className="menu-command-list">
            <button className="menu-command" type="button" onClick={onRender} title="Render diagram" aria-label="Render diagram">
              <Play size={15} />
            </button>
          </div>
        </div>
        <div className="menu-group" aria-label="AI">
          <span className="menu-group-label">AI</span>
          <div className="menu-command-list">
            <button
              className="menu-command"
              type="button"
              onClick={onToggleAiPanel}
              title={aiCollapsed ? "Open AI panel" : "Collapse AI panel"}
              aria-label={aiCollapsed ? "Open AI panel" : "Collapse AI panel"}
            >
              {aiCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
            </button>
          </div>
        </div>
        <div className="menu-group" aria-label="Help">
          <span className="menu-group-label">Help</span>
          <div className="menu-command-list">
            <button className="menu-command" type="button" onClick={onOpenDocs} title="Mermaid docs" aria-label="Mermaid docs">
              <BookOpen size={15} />
            </button>
          </div>
        </div>
        <div className="menu-group" aria-label="Settings">
          <span className="menu-group-label">Settings</span>
          <div className="menu-command-list">
            <button className="menu-command" type="button" onClick={onOpenSettings} title="Settings" aria-label="Settings">
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
