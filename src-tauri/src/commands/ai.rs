use crate::ai::prompts::{capability_instruction, CANONICAL_SYSTEM_PROMPT};
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

const AI_STREAM_EVENT: &str = "ai-stream";
const KEYRING_SERVICE: &str = "Mermaid Local";

#[derive(Default)]
pub struct AiRuntimeState {
    cancelled_requests: Mutex<HashSet<String>>,
}

impl AiRuntimeState {
    fn cancel(&self, request_id: &str) {
        if let Ok(mut requests) = self.cancelled_requests.lock() {
            requests.insert(request_id.to_string());
        }
    }

    fn clear(&self, request_id: &str) {
        if let Ok(mut requests) = self.cancelled_requests.lock() {
            requests.remove(request_id);
        }
    }

    fn is_cancelled(&self, request_id: &str) -> bool {
        self.cancelled_requests
            .lock()
            .map(|requests| requests.contains(request_id))
            .unwrap_or(false)
    }
}

#[derive(Debug, Error)]
pub enum AiCommandError {
    #[error("Prompt is empty.")]
    EmptyPrompt,
    #[error("AI request id is empty.")]
    EmptyRequestId,
    #[error("Cloud provider requires a user-supplied API key.")]
    MissingApiKey,
    #[error("Unsupported AI provider: {0}")]
    UnsupportedProvider(String),
    #[error("AI request was cancelled.")]
    Cancelled,
    #[error("AI request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("AI response was empty.")]
    EmptyResponse,
    #[error("Could not build AI request: {0}")]
    InvalidHeader(#[from] reqwest::header::InvalidHeaderValue),
    #[error("Could not emit AI stream event: {0}")]
    Emit(String),
    #[error("Could not access AI API key storage: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("Could not open AI history database: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Could not prepare AI history database: {0}")]
    Io(#[from] std::io::Error),
    #[error("Could not parse AI stream response: {0}")]
    Json(#[from] serde_json::Error),
    #[error("AI provider error: {0}")]
    Provider(String),
    #[error("Document id is empty.")]
    EmptyDocumentId,
}

impl serde::Serialize for AiCommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    pub request_id: Option<String>,
    pub provider: String,
    pub model: String,
    pub capability: String,
    pub prompt: String,
    pub code: String,
    pub selected_text: Option<String>,
    pub render_error: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResponse {
    pub provider: String,
    pub model: String,
    pub response: String,
    pub proposed_code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamEvent {
    pub request_id: String,
    pub kind: String,
    pub content: Option<String>,
    pub response: Option<AiResponse>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiHistoryInput {
    pub document_id: String,
    pub provider: String,
    pub model: String,
    pub capability: String,
    pub prompt: String,
    pub response: String,
    pub proposed_code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHistoryRecord {
    pub id: String,
    pub document_id: String,
    pub provider: String,
    pub model: String,
    pub capability: String,
    pub prompt: String,
    pub response: String,
    pub proposed_code: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaModel {
    pub name: String,
    pub model: String,
    pub modified_at: Option<String>,
    pub size: Option<i64>,
    pub family: Option<String>,
    pub parameter_size: Option<String>,
    pub quantization_level: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelRaw>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelRaw {
    name: String,
    model: Option<String>,
    modified_at: Option<String>,
    size: Option<i64>,
    details: Option<OllamaModelDetails>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelDetails {
    family: Option<String>,
    parameter_size: Option<String>,
    quantization_level: Option<String>,
}

#[derive(Debug, Serialize)]
struct OllamaGenerateRequest<'a> {
    model: &'a str,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamChunk {
    response: Option<String>,
    done: Option<bool>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    temperature: f32,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: String,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: Vec<AnthropicMessage>,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn database_path() -> Result<PathBuf, AiCommandError> {
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

fn open_ai_connection() -> Result<Connection, AiCommandError> {
    let path = database_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let connection = Connection::open(path)?;
    migrate_ai(&connection)?;
    Ok(connection)
}

fn migrate_ai(connection: &Connection) -> Result<(), AiCommandError> {
    connection.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS ai_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          capability TEXT NOT NULL,
          prompt TEXT NOT NULL,
          response TEXT NOT NULL,
          proposed_code TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ai_history_doc_time
          ON ai_history(document_id, created_at DESC, id DESC);
        "#,
    )?;
    Ok(())
}

fn ai_history_record_from_id(
    connection: &Connection,
    history_id: i64,
) -> Result<AiHistoryRecord, AiCommandError> {
    connection
        .query_row(
            r#"
            SELECT id, document_id, provider, model, capability, prompt, response, proposed_code, created_at
            FROM ai_history
            WHERE id = ?1
            "#,
            params![history_id],
            |row| {
                Ok(AiHistoryRecord {
                    id: row.get::<_, i64>(0)?.to_string(),
                    document_id: row.get(1)?,
                    provider: row.get(2)?,
                    model: row.get(3)?,
                    capability: row.get(4)?,
                    prompt: row.get(5)?,
                    response: row.get(6)?,
                    proposed_code: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .map_err(AiCommandError::Database)
}

fn request_id(input: &AiRequest) -> &str {
    input.request_id.as_deref().unwrap_or("legacy")
}

fn ensure_not_cancelled(state: &AiRuntimeState, input: &AiRequest) -> Result<(), AiCommandError> {
    if state.is_cancelled(request_id(input)) {
        return Err(AiCommandError::Cancelled);
    }

    Ok(())
}

fn emit_stream_event(
    app: &AppHandle,
    input: &AiRequest,
    kind: &str,
    content: Option<String>,
    response: Option<AiResponse>,
    error: Option<String>,
) -> Result<(), AiCommandError> {
    app.emit(
        AI_STREAM_EVENT,
        AiStreamEvent {
            request_id: request_id(input).to_string(),
            kind: kind.to_string(),
            content,
            response,
            error,
        },
    )
    .map_err(|error| AiCommandError::Emit(error.to_string()))
}

fn emit_chunk(app: &AppHandle, input: &AiRequest, chunk: String) -> Result<(), AiCommandError> {
    if chunk.is_empty() {
        return Ok(());
    }

    emit_stream_event(app, input, "chunk", Some(chunk), None, None)
}

fn keyring_entry(provider: &str) -> Result<keyring::Entry, AiCommandError> {
    let normalized = provider.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "openai" | "anthropic" => keyring::Entry::new(KEYRING_SERVICE, &format!("ai:{normalized}"))
            .map_err(AiCommandError::Keyring),
        provider => Err(AiCommandError::UnsupportedProvider(provider.to_string())),
    }
}

fn resolve_api_key(input: &AiRequest) -> Result<String, AiCommandError> {
    if let Some(api_key) = input
        .api_key
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        return Ok(api_key.trim().to_string());
    }

    get_ai_api_key(input.provider.clone())?.ok_or(AiCommandError::MissingApiKey)
}

fn build_user_prompt(input: &AiRequest) -> String {
    let mut prompt = String::new();
    prompt.push_str(capability_instruction(&input.capability));
    prompt.push_str("\n\nUser request:\n");
    prompt.push_str(input.prompt.trim());

    if let Some(render_error) = input
        .render_error
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        prompt.push_str("\n\nCurrent render error:\n");
        prompt.push_str(render_error.trim());
    }

    if let Some(selected_text) = input
        .selected_text
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        prompt.push_str("\n\nSelected Mermaid text:\n```mermaid\n");
        prompt.push_str(selected_text.trim());
        prompt.push_str("\n```");
    }

    if !input.code.trim().is_empty() {
        prompt.push_str("\n\nCurrent Mermaid document:\n```mermaid\n");
        prompt.push_str(input.code.trim());
        prompt.push_str("\n```");
    }

    if input.capability == "explain" {
        prompt.push_str("\n\nReturn a concise explanation only.");
    } else {
        prompt.push_str("\n\nReturn the complete replacement Mermaid document. Avoid markdown fences unless needed.");
    }

    prompt
}

fn strip_code_fence(response: &str) -> String {
    let trimmed = response.trim();
    if !trimmed.starts_with("```") {
        let lines: Vec<&str> = trimmed.lines().collect();
        for (index, line) in lines.iter().enumerate() {
            let info = line.trim_start();
            if !info.starts_with("```") {
                continue;
            }

            let Some(end_index) = lines[index + 1..]
                .iter()
                .position(|candidate| candidate.trim_start().starts_with("```"))
                .map(|position| index + 1 + position)
            else {
                continue;
            };

            let candidate = lines[index + 1..end_index].join("\n").trim().to_string();
            if info.contains("mermaid") || looks_like_mermaid_document(&candidate) {
                return candidate;
            }
        }

        return trimmed.to_string();
    }

    let mut lines = trimmed.lines();
    let first = lines.next().unwrap_or_default();
    if !first.starts_with("```") {
        return trimmed.to_string();
    }

    let body: Vec<&str> = lines.collect();
    let end_index = body
        .iter()
        .rposition(|line| line.trim_start().starts_with("```"))
        .unwrap_or(body.len());
    body[..end_index].join("\n").trim().to_string()
}

fn looks_like_mermaid_document(value: &str) -> bool {
    let mut in_frontmatter = false;
    let mut frontmatter_checked = false;
    let first_code_line = value.lines().map(str::trim).find(|line| {
        if line.is_empty() || line.starts_with("%%") {
            return false;
        }

        if !frontmatter_checked && *line == "---" {
            frontmatter_checked = true;
            in_frontmatter = true;
            return false;
        }

        if in_frontmatter {
            if *line == "---" {
                in_frontmatter = false;
            }
            return false;
        }

        true
    });

    matches!(
        first_code_line,
        Some(line)
            if line.starts_with("flowchart")
                || line.starts_with("graph")
                || line.starts_with("sequenceDiagram")
                || line.starts_with("classDiagram")
                || line.starts_with("stateDiagram")
                || line.starts_with("erDiagram")
                || line.starts_with("timeline")
                || line.starts_with("gantt")
                || line.starts_with("mindmap")
                || line.starts_with("pie")
                || line.starts_with("block-beta")
    )
}

fn make_response(input: &AiRequest, response: String) -> Result<AiResponse, AiCommandError> {
    if response.trim().is_empty() {
        return Err(AiCommandError::EmptyResponse);
    }

    let stripped = strip_code_fence(&response);
    let proposed_code = if input.capability == "explain" {
        None
    } else if looks_like_mermaid_document(&stripped) {
        Some(stripped.clone())
    } else {
        None
    };

    Ok(AiResponse {
        provider: input.provider.clone(),
        model: input.model.clone(),
        response,
        proposed_code,
    })
}

fn parse_ollama_line(line: &str) -> Result<Option<String>, AiCommandError> {
    if line.trim().is_empty() {
        return Ok(None);
    }

    let chunk: OllamaStreamChunk = serde_json::from_str(line)?;
    if let Some(error) = chunk.error {
        return Err(AiCommandError::Provider(error));
    }

    if chunk.done.unwrap_or(false) {
        return Ok(None);
    }

    Ok(chunk.response)
}

fn parse_openai_line(line: &str) -> Result<Option<String>, AiCommandError> {
    let trimmed = line.trim();
    if !trimmed.starts_with("data:") {
        return Ok(None);
    }

    let data = trimmed.trim_start_matches("data:").trim();
    if data.is_empty() || data == "[DONE]" {
        return Ok(None);
    }

    let value: serde_json::Value = serde_json::from_str(data)?;
    if let Some(error) = value.get("error") {
        let message = error
            .get("message")
            .and_then(|value| value.as_str())
            .unwrap_or("OpenAI stream returned an error.");
        return Err(AiCommandError::Provider(message.to_string()));
    }

    Ok(value
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("delta"))
        .and_then(|delta| delta.get("content"))
        .and_then(|content| content.as_str())
        .map(ToOwned::to_owned))
}

fn parse_anthropic_line(line: &str) -> Result<Option<String>, AiCommandError> {
    let trimmed = line.trim();
    if !trimmed.starts_with("data:") {
        return Ok(None);
    }

    let data = trimmed.trim_start_matches("data:").trim();
    if data.is_empty() || data == "[DONE]" {
        return Ok(None);
    }

    let value: serde_json::Value = serde_json::from_str(data)?;
    if value.get("type").and_then(|value| value.as_str()) == Some("error") {
        let message = value
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(|message| message.as_str())
            .unwrap_or("Anthropic stream returned an error.");
        return Err(AiCommandError::Provider(message.to_string()));
    }

    Ok(value
        .get("delta")
        .and_then(|delta| delta.get("text"))
        .and_then(|text| text.as_str())
        .map(ToOwned::to_owned))
}

async fn process_line_stream<F>(
    response: reqwest::Response,
    app: &AppHandle,
    state: &AiRuntimeState,
    input: &AiRequest,
    mut parse_line: F,
) -> Result<String, AiCommandError>
where
    F: FnMut(&str) -> Result<Option<String>, AiCommandError>,
{
    let mut stream = response.bytes_stream();
    let mut pending = String::new();
    let mut output = String::new();

    while let Some(chunk) = stream.next().await {
        ensure_not_cancelled(state, input)?;
        pending.push_str(&String::from_utf8_lossy(&chunk?));

        while let Some(newline_index) = pending.find('\n') {
            let line: String = pending.drain(..=newline_index).collect();
            let line = line.trim_end_matches(|character| character == '\r' || character == '\n');
            if let Some(token) = parse_line(line)? {
                output.push_str(&token);
                emit_chunk(app, input, token)?;
            }
            ensure_not_cancelled(state, input)?;
        }
    }

    if !pending.trim().is_empty() {
        if let Some(token) = parse_line(pending.trim_end())? {
            output.push_str(&token);
            emit_chunk(app, input, token)?;
        }
    }

    Ok(output)
}

async fn call_ollama(
    app: &AppHandle,
    state: &AiRuntimeState,
    input: &AiRequest,
) -> Result<String, AiCommandError> {
    let client = reqwest::Client::builder().build()?;
    let body = OllamaGenerateRequest {
        model: &input.model,
        prompt: format!(
            "{}\n\n{}",
            CANONICAL_SYSTEM_PROMPT,
            build_user_prompt(input)
        ),
        stream: true,
        options: OllamaOptions { temperature: 0.2 },
    };
    let response = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await?
        .error_for_status()?;

    process_line_stream(response, app, state, input, parse_ollama_line).await
}

async fn fetch_ollama_models() -> Result<Vec<OllamaModel>, AiCommandError> {
    let client = reqwest::Client::builder().build()?;
    let response = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await?
        .error_for_status()?
        .json::<OllamaTagsResponse>()
        .await?;

    Ok(response
        .models
        .into_iter()
        .map(|model| {
            let details = model.details;
            OllamaModel {
                model: model.model.clone().unwrap_or_else(|| model.name.clone()),
                name: model.name,
                modified_at: model.modified_at,
                size: model.size,
                family: details.as_ref().and_then(|details| details.family.clone()),
                parameter_size: details
                    .as_ref()
                    .and_then(|details| details.parameter_size.clone()),
                quantization_level: details
                    .as_ref()
                    .and_then(|details| details.quantization_level.clone()),
            }
        })
        .collect())
}

async fn call_openai(
    app: &AppHandle,
    state: &AiRuntimeState,
    input: &AiRequest,
) -> Result<String, AiCommandError> {
    let api_key = resolve_api_key(input)?;
    let client = reqwest::Client::builder().build()?;
    let body = ChatCompletionRequest {
        model: &input.model,
        temperature: 0.2,
        stream: true,
        messages: vec![
            ChatMessage {
                role: "system",
                content: CANONICAL_SYSTEM_PROMPT.to_string(),
            },
            ChatMessage {
                role: "user",
                content: build_user_prompt(input),
            },
        ],
    };
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))?,
    );

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .headers(headers)
        .json(&body)
        .send()
        .await?
        .error_for_status()?;

    process_line_stream(response, app, state, input, parse_openai_line).await
}

async fn call_anthropic(
    app: &AppHandle,
    state: &AiRuntimeState,
    input: &AiRequest,
) -> Result<String, AiCommandError> {
    let api_key = resolve_api_key(input)?;
    let client = reqwest::Client::builder().build()?;
    let body = AnthropicRequest {
        model: &input.model,
        max_tokens: 4096,
        system: CANONICAL_SYSTEM_PROMPT,
        stream: true,
        messages: vec![AnthropicMessage {
            role: "user".to_string(),
            content: build_user_prompt(input),
        }],
    };
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
    headers.insert("x-api-key", HeaderValue::from_str(api_key.trim())?);

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .headers(headers)
        .json(&body)
        .send()
        .await?
        .error_for_status()?;

    process_line_stream(response, app, state, input, parse_anthropic_line).await
}

#[tauri::command]
pub fn cancel_ai_request(
    state: State<'_, AiRuntimeState>,
    request_id: String,
) -> Result<(), AiCommandError> {
    if request_id.trim().is_empty() {
        return Err(AiCommandError::EmptyRequestId);
    }

    state.inner().cancel(request_id.trim());
    Ok(())
}

#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<OllamaModel>, AiCommandError> {
    fetch_ollama_models().await
}

#[tauri::command]
pub fn save_ai_api_key(provider: String, api_key: String) -> Result<(), AiCommandError> {
    let entry = keyring_entry(&provider)?;
    if api_key.trim().is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(AiCommandError::Keyring(error)),
        }
    } else {
        entry.set_password(api_key.trim())?;
        Ok(())
    }
}

#[tauri::command]
pub fn get_ai_api_key(provider: String) -> Result<Option<String>, AiCommandError> {
    let entry = keyring_entry(&provider)?;
    match entry.get_password() {
        Ok(api_key) => Ok(Some(api_key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(AiCommandError::Keyring(error)),
    }
}

#[tauri::command]
pub fn delete_ai_api_key(provider: String) -> Result<(), AiCommandError> {
    let entry = keyring_entry(&provider)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(AiCommandError::Keyring(error)),
    }
}

#[tauri::command]
pub fn save_ai_history(input: SaveAiHistoryInput) -> Result<AiHistoryRecord, AiCommandError> {
    if input.document_id.trim().is_empty() {
        return Err(AiCommandError::EmptyDocumentId);
    }

    let connection = open_ai_connection()?;
    let timestamp = now_ms();
    connection.execute(
        r#"
        INSERT INTO ai_history
          (document_id, provider, model, capability, prompt, response, proposed_code, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        params![
            input.document_id.trim(),
            input.provider,
            input.model,
            input.capability,
            input.prompt,
            input.response,
            input.proposed_code,
            timestamp
        ],
    )?;

    ai_history_record_from_id(&connection, connection.last_insert_rowid())
}

#[tauri::command]
pub fn list_ai_history(
    document_id: String,
    limit: Option<u32>,
) -> Result<Vec<AiHistoryRecord>, AiCommandError> {
    if document_id.trim().is_empty() {
        return Err(AiCommandError::EmptyDocumentId);
    }

    let connection = open_ai_connection()?;
    let limit = limit.unwrap_or(50).clamp(1, 200);
    let mut statement = connection.prepare(
        r#"
        SELECT id, document_id, provider, model, capability, prompt, response, proposed_code, created_at
        FROM ai_history
        WHERE document_id = ?1
        ORDER BY created_at DESC, id DESC
        LIMIT ?2
        "#,
    )?;

    let rows = statement.query_map(params![document_id.trim(), limit], |row| {
        Ok(AiHistoryRecord {
            id: row.get::<_, i64>(0)?.to_string(),
            document_id: row.get(1)?,
            provider: row.get(2)?,
            model: row.get(3)?,
            capability: row.get(4)?,
            prompt: row.get(5)?,
            response: row.get(6)?,
            proposed_code: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(AiCommandError::Database)
}

#[tauri::command]
pub async fn run_ai_request(
    app: AppHandle,
    state: State<'_, AiRuntimeState>,
    input: AiRequest,
) -> Result<AiResponse, AiCommandError> {
    if input.prompt.trim().is_empty() {
        return Err(AiCommandError::EmptyPrompt);
    }

    let runtime_state = state.inner();
    runtime_state.clear(request_id(&input));
    emit_stream_event(&app, &input, "start", None, None, None)?;

    let response_result = match input.provider.as_str() {
        "ollama" => call_ollama(&app, runtime_state, &input).await,
        "openai" => call_openai(&app, runtime_state, &input).await,
        "anthropic" => call_anthropic(&app, runtime_state, &input).await,
        provider => Err(AiCommandError::UnsupportedProvider(provider.to_string())),
    }
    .and_then(|response| make_response(&input, response));

    match response_result {
        Ok(response) => {
            runtime_state.clear(request_id(&input));
            emit_stream_event(&app, &input, "done", None, Some(response.clone()), None)?;
            Ok(response)
        }
        Err(error) => {
            let kind = if matches!(error, AiCommandError::Cancelled) {
                "cancelled"
            } else {
                "error"
            };
            let _ = emit_stream_event(&app, &input, kind, None, None, Some(error.to_string()));
            runtime_state.clear(request_id(&input));
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        list_ai_history, make_response, migrate_ai, save_ai_history, AiRequest, SaveAiHistoryInput,
    };
    use rusqlite::Connection;

    fn ai_request(capability: &str) -> AiRequest {
        AiRequest {
            request_id: Some("test-request".to_string()),
            provider: "ollama".to_string(),
            model: "qwen2.5-coder:14b".to_string(),
            capability: capability.to_string(),
            prompt: "Restyle this diagram.".to_string(),
            code: "flowchart TB\n  A --> B".to_string(),
            selected_text: None,
            render_error: None,
            api_key: None,
        }
    }

    #[test]
    fn ai_history_round_trips_per_document() {
        let connection = Connection::open_in_memory().expect("in-memory database should open");
        migrate_ai(&connection).expect("migration should succeed");

        connection
            .execute(
                r#"
                INSERT INTO ai_history
                  (document_id, provider, model, capability, prompt, response, proposed_code, created_at)
                VALUES ('doc-a', 'ollama', 'qwen', 'generate', 'make one', 'done', 'flowchart TB', 1)
                "#,
                [],
            )
            .expect("history insert should succeed");

        let mut statement = connection
            .prepare("SELECT COUNT(*) FROM ai_history WHERE document_id = 'doc-a'")
            .expect("query should prepare");
        let count: i64 = statement
            .query_row([], |row| row.get(0))
            .expect("query should run");
        assert_eq!(count, 1);
    }

    #[test]
    fn ai_history_commands_reject_empty_document_ids() {
        let input = SaveAiHistoryInput {
            document_id: String::new(),
            provider: "ollama".to_string(),
            model: "qwen".to_string(),
            capability: "generate".to_string(),
            prompt: "prompt".to_string(),
            response: "response".to_string(),
            proposed_code: None,
        };

        assert!(save_ai_history(input).is_err());
        assert!(list_ai_history(String::new(), Some(10)).is_err());
    }

    #[test]
    fn fenced_frontmatter_mermaid_response_becomes_proposal() {
        let response = r#"```mermaid
---
config:
  layout: elk
---
flowchart TB
  A --> B
```"#;

        let result = make_response(&ai_request("restyle"), response.to_string())
            .expect("frontmatter response should parse");

        assert!(result
            .proposed_code
            .as_deref()
            .expect("proposal should exist")
            .starts_with("---"));
    }

    #[test]
    fn prefaced_mermaid_fence_becomes_proposal() {
        let response = r#"Here is the updated diagram:

```mermaid
flowchart TB
  A --> B
```"#;

        let result = make_response(&ai_request("edit"), response.to_string())
            .expect("prefaced fenced response should parse");

        assert_eq!(
            result.proposed_code.as_deref(),
            Some("flowchart TB\n  A --> B")
        );
    }
}
