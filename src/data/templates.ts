export interface MermaidTemplate {
  id: string;
  category: string;
  name: string;
  code: string;
}

export const templateCategories = [
  "All",
  "Flowchart",
  "Sequence",
  "Class",
  "State",
  "ER",
  "Timeline",
  "Gantt",
  "Mindmap",
  "Pie",
  "Architecture"
];

export const mermaidTemplates: MermaidTemplate[] = [
  {
    id: "flow-auth",
    category: "Flowchart",
    name: "Auth Flow",
    code: `flowchart TB
  Start([User opens app]) --> Login{Has session?}
  Login -->|Yes| Dashboard[Show dashboard]
  Login -->|No| Credentials[Enter credentials]
  Credentials --> Verify{Valid?}
  Verify -->|Yes| Dashboard
  Verify -->|No| Retry[Show error] --> Credentials`
  },
  {
    id: "flow-release",
    category: "Flowchart",
    name: "Release Pipeline",
    code: `flowchart LR
  Commit[Commit] --> Build[Build]
  Build --> Test[Test suite]
  Test --> Security[Security scan]
  Security --> Deploy[Deploy]
  Deploy --> Observe[Observe]`
  },
  {
    id: "seq-api",
    category: "Sequence",
    name: "API Request",
    code: `sequenceDiagram
  participant U as User
  participant W as Web App
  participant A as API
  participant D as Database
  U->>W: Submit form
  W->>A: POST /request
  A->>D: Insert row
  D-->>A: Row id
  A-->>W: 201 Created
  W-->>U: Show success`
  },
  {
    id: "class-domain",
    category: "Class",
    name: "Domain Model",
    code: `classDiagram
  class Project {
    +String name
    +Date createdAt
  }
  class Diagram {
    +String filename
    +String content
  }
  Project "1" --> "*" Diagram`
  },
  {
    id: "state-doc",
    category: "State",
    name: "Document State",
    code: `stateDiagram-v2
  [*] --> Clean
  Clean --> Modified: edit
  Modified --> Saving: save
  Saving --> Clean: success
  Saving --> Modified: failure
  Modified --> [*]: close without save`
  },
  {
    id: "er-commerce",
    category: "ER",
    name: "Commerce ERD",
    code: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : appears_in
  CUSTOMER {
    string id
    string email
  }
  PRODUCT {
    string sku
    string name
  }`
  },
  {
    id: "timeline-sprint",
    category: "Timeline",
    name: "Sprint Timeline",
    code: `timeline
  title Sprint Plan
  section Week 1
    Design : Wireframes and review
    Build : Core implementation
  section Week 2
    Test : QA and fixes
    Ship : Release notes and launch`
  },
  {
    id: "gantt-launch",
    category: "Gantt",
    name: "Launch Plan",
    code: `gantt
  title Launch Plan
  dateFormat  YYYY-MM-DD
  section Product
  Scope          :a1, 2026-05-01, 3d
  Build          :a2, after a1, 7d
  section Go To Market
  Docs           :b1, 2026-05-04, 5d
  Release        :milestone, after a2, 1d`
  },
  {
    id: "mindmap-roadmap",
    category: "Mindmap",
    name: "Roadmap",
    code: `mindmap
  root((Mermaid Local))
    Editor
      Monaco
      Diagnostics
    Canvas
      Pan
      Zoom
    History
      Snapshots
      Restore`
  },
  {
    id: "pie-effort",
    category: "Pie",
    name: "Effort Split",
    code: `pie title Phase 2 Effort
  "Canvas" : 35
  "Templates" : 20
  "Layout" : 30
  "Polish" : 15`
  },
  {
    id: "block-local-app",
    category: "Architecture",
    name: "Local App Stack",
    code: `block-beta
  columns 3
  ui["React UI"]
  rust["Rust Commands"]
  db[("SQLite")]
  files["Local Files"]
  ai["AI Provider"]
  export["Exports"]
  ui --> rust
  rust --> db
  rust --> files
  rust --> ai
  rust --> export`
  }
];
