use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Cursor,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;

const FULL_SNAPSHOT_INTERVAL: i64 = 50;

#[derive(Debug, Error)]
pub enum SnapshotCommandError {
    #[error("Document id is empty.")]
    EmptyDocumentId,
    #[error("Snapshot was not found.")]
    SnapshotNotFound,
    #[error("Snapshot chain is incomplete.")]
    IncompleteChain,
    #[error("Snapshot payload is invalid.")]
    InvalidPayload,
    #[error("Could not open snapshot database: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Could not prepare snapshot database: {0}")]
    Io(#[from] std::io::Error),
    #[error("Could not encode snapshot payload: {0}")]
    Json(#[from] serde_json::Error),
}

impl serde::Serialize for SnapshotCommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSnapshotInput {
    pub document_id: String,
    pub file_name: String,
    pub file_path: Option<String>,
    pub diagram_type: Option<String>,
    pub content: String,
    pub trigger: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotMeta {
    pub id: i64,
    pub document_id: String,
    pub parent_id: Option<i64>,
    pub kind: String,
    pub byte_size: i64,
    pub created_at: i64,
    pub trigger: String,
    pub label: Option<String>,
    pub thumbnail_present: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRecord {
    pub id: String,
    pub file_name: String,
    pub file_path: Option<String>,
    pub diagram_type: Option<String>,
    pub content: String,
    pub modified_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SpliceDiff {
    start: usize,
    delete_count: usize,
    insert: String,
}

#[derive(Debug)]
struct SnapshotRow {
    parent_id: Option<i64>,
    kind: String,
    payload: Vec<u8>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn database_path() -> Result<PathBuf, SnapshotCommandError> {
    if let Ok(path) = std::env::var("MERMAID_LOCAL_DB_PATH") {
        return Ok(PathBuf::from(path));
    }

    #[cfg(target_os = "windows")]
    let base_dir = std::env::var_os("APPDATA").map(PathBuf::from).or_else(|| {
        std::env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join("AppData\\Roaming"))
    });

    #[cfg(target_os = "macos")]
    let base_dir = std::env::var_os("HOME")
        .map(|home| PathBuf::from(home).join("Library/Application Support"));

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let base_dir = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")));

    let base_dir = base_dir.unwrap_or_else(|| PathBuf::from("."));
    Ok(base_dir.join("mermaid-local").join("snapshots.db"))
}

fn open_connection() -> Result<Connection, SnapshotCommandError> {
    let path = database_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let connection = Connection::open(path)?;
    migrate(&connection)?;
    Ok(connection)
}

fn migrate(connection: &Connection) -> Result<(), SnapshotCommandError> {
    connection.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          file_path TEXT,
          diagram_type TEXT,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          modified_at INTEGER NOT NULL,
          starred INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          parent_id INTEGER REFERENCES snapshots(id),
          kind TEXT NOT NULL CHECK (kind IN ('full','diff')),
          payload BLOB NOT NULL,
          byte_size INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          trigger TEXT NOT NULL,
          label TEXT,
          thumbnail BLOB
        );

        CREATE INDEX IF NOT EXISTS idx_snap_doc_time ON snapshots(document_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_snap_starred ON snapshots(document_id) WHERE label IS NOT NULL;

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recents (
          path TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          last_opened INTEGER NOT NULL
        );
        "#,
    )?;
    Ok(())
}

fn compress_bytes(bytes: &[u8]) -> Result<Vec<u8>, SnapshotCommandError> {
    zstd::stream::encode_all(bytes, 3).map_err(SnapshotCommandError::Io)
}

fn decompress_bytes(bytes: &[u8]) -> Result<Vec<u8>, SnapshotCommandError> {
    zstd::stream::decode_all(Cursor::new(bytes)).map_err(SnapshotCommandError::Io)
}

fn make_splice_diff(previous: &str, next: &str) -> SpliceDiff {
    let previous_chars: Vec<char> = previous.chars().collect();
    let next_chars: Vec<char> = next.chars().collect();
    let mut start = 0;

    while start < previous_chars.len()
        && start < next_chars.len()
        && previous_chars[start] == next_chars[start]
    {
        start += 1;
    }

    let mut suffix = 0;
    while suffix + start < previous_chars.len()
        && suffix + start < next_chars.len()
        && previous_chars[previous_chars.len() - 1 - suffix]
            == next_chars[next_chars.len() - 1 - suffix]
    {
        suffix += 1;
    }

    SpliceDiff {
        start,
        delete_count: previous_chars.len() - start - suffix,
        insert: next_chars[start..next_chars.len() - suffix]
            .iter()
            .collect(),
    }
}

fn apply_splice_diff(previous: &str, diff: SpliceDiff) -> Result<String, SnapshotCommandError> {
    let mut chars: Vec<char> = previous.chars().collect();
    if diff.start > chars.len() || diff.start + diff.delete_count > chars.len() {
        return Err(SnapshotCommandError::InvalidPayload);
    }

    chars.splice(
        diff.start..diff.start + diff.delete_count,
        diff.insert.chars(),
    );
    Ok(chars.into_iter().collect())
}

fn encode_full_payload(content: &str) -> Result<Vec<u8>, SnapshotCommandError> {
    compress_bytes(content.as_bytes())
}

fn decode_full_payload(payload: &[u8]) -> Result<String, SnapshotCommandError> {
    let bytes = decompress_bytes(payload)?;
    String::from_utf8(bytes).map_err(|_| SnapshotCommandError::InvalidPayload)
}

fn encode_diff_payload(previous: &str, next: &str) -> Result<Vec<u8>, SnapshotCommandError> {
    let diff = make_splice_diff(previous, next);
    let json = serde_json::to_vec(&diff)?;
    compress_bytes(&json)
}

fn decode_diff_payload(payload: &[u8]) -> Result<SpliceDiff, SnapshotCommandError> {
    let bytes = decompress_bytes(payload)?;
    serde_json::from_slice(&bytes).map_err(SnapshotCommandError::Json)
}

fn get_snapshot_row(
    connection: &Connection,
    snapshot_id: i64,
) -> Result<Option<SnapshotRow>, SnapshotCommandError> {
    connection
        .query_row(
            "SELECT id, parent_id, kind, payload FROM snapshots WHERE id = ?1",
            params![snapshot_id],
            |row| {
                Ok(SnapshotRow {
                    parent_id: row.get(1)?,
                    kind: row.get(2)?,
                    payload: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(SnapshotCommandError::Database)
}

fn restore_snapshot_content(
    connection: &Connection,
    snapshot_id: i64,
) -> Result<String, SnapshotCommandError> {
    let mut chain = Vec::new();
    let mut cursor_id = snapshot_id;

    loop {
        let row = get_snapshot_row(connection, cursor_id)?
            .ok_or(SnapshotCommandError::SnapshotNotFound)?;
        let is_full = row.kind == "full";
        let parent_id = row.parent_id;
        chain.push(row);

        if is_full {
            break;
        }

        cursor_id = parent_id.ok_or(SnapshotCommandError::IncompleteChain)?;
    }

    let full = chain.pop().ok_or(SnapshotCommandError::IncompleteChain)?;
    if full.kind != "full" {
        return Err(SnapshotCommandError::IncompleteChain);
    }

    let mut content = decode_full_payload(&full.payload)?;
    for row in chain.iter().rev() {
        let diff = decode_diff_payload(&row.payload)?;
        content = apply_splice_diff(&content, diff)?;
    }

    Ok(content)
}

fn snapshot_meta_from_id(
    connection: &Connection,
    snapshot_id: i64,
) -> Result<SnapshotMeta, SnapshotCommandError> {
    connection.query_row(
        r#"
        SELECT id, document_id, parent_id, kind, byte_size, created_at, trigger, label, thumbnail IS NOT NULL
        FROM snapshots
        WHERE id = ?1
        "#,
        params![snapshot_id],
        |row| {
            Ok(SnapshotMeta {
                id: row.get(0)?,
                document_id: row.get(1)?,
                parent_id: row.get(2)?,
                kind: row.get(3)?,
                byte_size: row.get(4)?,
                created_at: row.get(5)?,
                trigger: row.get(6)?,
                label: row.get(7)?,
                thumbnail_present: row.get::<_, i64>(8)? == 1,
            })
        },
    ).map_err(SnapshotCommandError::Database)
}

fn ensure_document(
    connection: &Connection,
    input: &SaveSnapshotInput,
    timestamp: i64,
) -> Result<(), SnapshotCommandError> {
    if input.document_id.trim().is_empty() {
        return Err(SnapshotCommandError::EmptyDocumentId);
    }

    connection.execute(
        r#"
        INSERT INTO documents (id, filename, file_path, diagram_type, content, created_at, modified_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
        ON CONFLICT(id) DO NOTHING
        "#,
        params![
            &input.document_id,
            &input.file_name,
            &input.file_path,
            &input.diagram_type,
            &input.content,
            timestamp
        ],
    )?;

    Ok(())
}

fn save_snapshot_with_connection(
    connection: &Connection,
    input: SaveSnapshotInput,
) -> Result<SnapshotMeta, SnapshotCommandError> {
    let timestamp = now_ms();
    ensure_document(connection, &input, timestamp)?;

    let parent_id: Option<i64> = connection
        .query_row(
            "SELECT id FROM snapshots WHERE document_id = ?1 ORDER BY id DESC LIMIT 1",
            params![&input.document_id],
            |row| row.get(0),
        )
        .optional()?;

    let snapshot_count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM snapshots WHERE document_id = ?1",
        params![&input.document_id],
        |row| row.get(0),
    )?;

    let (kind, payload) = if let Some(parent_id) = parent_id {
        if snapshot_count % FULL_SNAPSHOT_INTERVAL == 0 {
            ("full".to_string(), encode_full_payload(&input.content)?)
        } else {
            let previous_content = restore_snapshot_content(connection, parent_id)?;
            (
                "diff".to_string(),
                encode_diff_payload(&previous_content, &input.content)?,
            )
        }
    } else {
        ("full".to_string(), encode_full_payload(&input.content)?)
    };

    let byte_size = payload.len() as i64;
    connection.execute(
        r#"
        INSERT INTO snapshots (document_id, parent_id, kind, payload, byte_size, created_at, trigger, label)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        params![
            &input.document_id,
            parent_id,
            &kind,
            &payload,
            byte_size,
            timestamp,
            &input.trigger,
            &input.label
        ],
    )?;

    let snapshot_id = connection.last_insert_rowid();
    connection.execute(
        r#"
        UPDATE documents
        SET filename = ?2,
            file_path = ?3,
            diagram_type = ?4,
            content = ?5,
            modified_at = ?6
        WHERE id = ?1
        "#,
        params![
            &input.document_id,
            &input.file_name,
            &input.file_path,
            &input.diagram_type,
            &input.content,
            timestamp
        ],
    )?;

    if let Some(file_path) = input.file_path.filter(|path| !path.trim().is_empty()) {
        connection.execute(
            r#"
            INSERT INTO recents (path, kind, last_opened)
            VALUES (?1, 'file', ?2)
            ON CONFLICT(path) DO UPDATE SET kind = excluded.kind, last_opened = excluded.last_opened
            "#,
            params![file_path, timestamp],
        )?;
    }

    snapshot_meta_from_id(connection, snapshot_id)
}

#[tauri::command]
pub fn save_snapshot(input: SaveSnapshotInput) -> Result<SnapshotMeta, SnapshotCommandError> {
    let connection = open_connection()?;
    save_snapshot_with_connection(&connection, input)
}

#[tauri::command]
pub fn list_snapshots(
    document_id: String,
    limit: u32,
    offset: u32,
) -> Result<Vec<SnapshotMeta>, SnapshotCommandError> {
    let connection = open_connection()?;
    let mut statement = connection.prepare(
        r#"
        SELECT id, document_id, parent_id, kind, byte_size, created_at, trigger, label, thumbnail IS NOT NULL
        FROM snapshots
        WHERE document_id = ?1
        ORDER BY created_at DESC, id DESC
        LIMIT ?2 OFFSET ?3
        "#,
    )?;

    let rows = statement.query_map(params![&document_id, limit, offset], |row| {
        Ok(SnapshotMeta {
            id: row.get(0)?,
            document_id: row.get(1)?,
            parent_id: row.get(2)?,
            kind: row.get(3)?,
            byte_size: row.get(4)?,
            created_at: row.get(5)?,
            trigger: row.get(6)?,
            label: row.get(7)?,
            thumbnail_present: row.get::<_, i64>(8)? == 1,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(SnapshotCommandError::Database)
}

#[tauri::command]
pub fn get_snapshot_content(snapshot_id: i64) -> Result<String, SnapshotCommandError> {
    let connection = open_connection()?;
    restore_snapshot_content(&connection, snapshot_id)
}

#[tauri::command]
pub fn restore_snapshot(snapshot_id: i64) -> Result<String, SnapshotCommandError> {
    get_snapshot_content(snapshot_id)
}

#[tauri::command]
pub fn get_latest_document() -> Result<Option<DocumentRecord>, SnapshotCommandError> {
    let connection = open_connection()?;
    connection
        .query_row(
            r#"
            SELECT id, filename, file_path, diagram_type, content, modified_at
            FROM documents
            ORDER BY modified_at DESC
            LIMIT 1
            "#,
            [],
            |row| {
                Ok(DocumentRecord {
                    id: row.get(0)?,
                    file_name: row.get(1)?,
                    file_path: row.get(2)?,
                    diagram_type: row.get(3)?,
                    content: row.get(4)?,
                    modified_at: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(SnapshotCommandError::Database)
}

#[tauri::command]
pub fn prune_snapshots(
    document_id: String,
    keep_latest: u32,
) -> Result<usize, SnapshotCommandError> {
    let connection = open_connection()?;
    if keep_latest == 0 {
        return connection
            .execute(
                "DELETE FROM snapshots WHERE document_id = ?1",
                params![&document_id],
            )
            .map_err(SnapshotCommandError::Database);
    }

    let oldest_kept_id: Option<i64> = connection
        .query_row(
            r#"
            SELECT id FROM snapshots
            WHERE document_id = ?1
            ORDER BY created_at DESC, id DESC
            LIMIT 1 OFFSET ?2
            "#,
            params![&document_id, keep_latest.saturating_sub(1)],
            |row| row.get(0),
        )
        .optional()?;

    let Some(oldest_kept_id) = oldest_kept_id else {
        return Ok(0);
    };

    let cutoff_full_id: Option<i64> = connection
        .query_row(
            r#"
            SELECT id FROM snapshots
            WHERE document_id = ?1 AND id <= ?2 AND kind = 'full'
            ORDER BY id DESC
            LIMIT 1
            "#,
            params![&document_id, oldest_kept_id],
            |row| row.get(0),
        )
        .optional()?;

    let Some(cutoff_full_id) = cutoff_full_id else {
        return Ok(0);
    };

    connection
        .execute(
            "DELETE FROM snapshots WHERE document_id = ?1 AND id < ?2",
            params![&document_id, cutoff_full_id],
        )
        .map_err(SnapshotCommandError::Database)
}

#[cfg(test)]
mod tests {
    use super::{
        migrate, restore_snapshot_content, save_snapshot_with_connection, SaveSnapshotInput,
    };
    use rusqlite::Connection;

    fn input(document_id: &str, content: &str, trigger: &str) -> SaveSnapshotInput {
        SaveSnapshotInput {
            document_id: document_id.to_string(),
            file_name: "test.mmd".to_string(),
            file_path: None,
            diagram_type: Some("flowchart".to_string()),
            content: content.to_string(),
            trigger: trigger.to_string(),
            label: None,
        }
    }

    #[test]
    fn snapshots_round_trip_full_and_diff_content() {
        let connection = Connection::open_in_memory().expect("in-memory database should open");
        migrate(&connection).expect("migration should succeed");

        let first = save_snapshot_with_connection(
            &connection,
            input("doc-1", "flowchart TB\n  A --> B", "open"),
        )
        .expect("first snapshot should save");
        let second = save_snapshot_with_connection(
            &connection,
            input("doc-1", "flowchart TB\n  A --> C", "edit"),
        )
        .expect("second snapshot should save");

        assert_eq!(first.kind, "full");
        assert_eq!(second.kind, "diff");
        assert_eq!(
            restore_snapshot_content(&connection, second.id).expect("snapshot should restore"),
            "flowchart TB\n  A --> C"
        );
    }

    #[test]
    fn unicode_diff_snapshot_restores() {
        let connection = Connection::open_in_memory().expect("in-memory database should open");
        migrate(&connection).expect("migration should succeed");

        save_snapshot_with_connection(
            &connection,
            input("doc-2", "flowchart TB\n  A[Start] --> B[Done]", "open"),
        )
        .expect("first snapshot should save");
        let second = save_snapshot_with_connection(
            &connection,
            input("doc-2", "flowchart TB\n  A[Début] --> B[✅]", "edit"),
        )
        .expect("second snapshot should save");

        assert_eq!(
            restore_snapshot_content(&connection, second.id).expect("snapshot should restore"),
            "flowchart TB\n  A[Début] --> B[✅]"
        );
    }

    #[test]
    fn restore_reports_missing_snapshot() {
        let connection = Connection::open_in_memory().expect("in-memory database should open");
        migrate(&connection).expect("migration should succeed");
        let missing =
            restore_snapshot_content(&connection, -1).expect_err("missing snapshot should fail");

        assert_eq!(missing.to_string(), "Snapshot was not found.");
    }
}
