use std::{fs, path::PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum FileCommandError {
    #[error("Path is empty.")]
    EmptyPath,
    #[error("Could not read file: {0}")]
    Read(std::io::Error),
    #[error("Could not write file: {0}")]
    Write(std::io::Error),
}

impl serde::Serialize for FileCommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

fn normalize_path(path: String) -> Result<PathBuf, FileCommandError> {
    if path.trim().is_empty() {
        return Err(FileCommandError::EmptyPath);
    }

    Ok(PathBuf::from(path))
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, FileCommandError> {
    let path = normalize_path(path)?;
    fs::read_to_string(path).map_err(FileCommandError::Read)
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), FileCommandError> {
    let path = normalize_path(path)?;
    fs::write(path, content).map_err(FileCommandError::Write)
}

#[cfg(test)]
mod tests {
    use super::{read_text_file, write_text_file, FileCommandError};
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_file_path(name: &str) -> PathBuf {
        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX_EPOCH")
            .as_nanos();

        std::env::temp_dir().join(format!(
            "mermaid-local-{}-{}-{}.mmd",
            name,
            std::process::id(),
            unique_id
        ))
    }

    #[test]
    fn write_then_read_text_file_round_trips_mermaid_content() {
        let path = temp_file_path("roundtrip");
        let content = "flowchart TB\n  A[Start] --> B[Done]\n";

        write_text_file(path.to_string_lossy().into_owned(), content.to_string())
            .expect("write should succeed");
        let saved_content =
            read_text_file(path.to_string_lossy().into_owned()).expect("read should succeed");

        assert_eq!(saved_content, content);
        fs::remove_file(path).expect("temporary file should be removable");
    }

    #[test]
    fn read_text_file_rejects_blank_path() {
        let error = read_text_file("   ".to_string()).expect_err("blank path should fail");

        assert!(matches!(error, FileCommandError::EmptyPath));
        assert_eq!(error.to_string(), "Path is empty.");
    }

    #[test]
    fn write_text_file_rejects_blank_path() {
        let error = write_text_file("\n\t".to_string(), "flowchart TB".to_string())
            .expect_err("blank path should fail");

        assert!(matches!(error, FileCommandError::EmptyPath));
        assert_eq!(error.to_string(), "Path is empty.");
    }
}
