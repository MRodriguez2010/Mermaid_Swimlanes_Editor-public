use std::process::Command;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SystemCommandError {
    #[error("External URL is not allowed.")]
    UrlNotAllowed,
    #[error("Could not open URL: {0}")]
    Open(std::io::Error),
}

impl serde::Serialize for SystemCommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

fn validate_external_url(url: &str) -> Result<&str, SystemCommandError> {
    let trimmed_url = url.trim();
    if trimmed_url.starts_with("https://mermaid.js.org/") {
        return Ok(trimmed_url);
    }

    Err(SystemCommandError::UrlNotAllowed)
}

#[cfg(target_os = "macos")]
fn spawn_url_opener(url: &str) -> std::io::Result<()> {
    Command::new("open").arg(url).spawn()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn spawn_url_opener(url: &str) -> std::io::Result<()> {
    Command::new("cmd").args(["/C", "start", "", url]).spawn()?;
    Ok(())
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn spawn_url_opener(url: &str) -> std::io::Result<()> {
    Command::new("xdg-open").arg(url).spawn()?;
    Ok(())
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), SystemCommandError> {
    let url = validate_external_url(&url)?;
    spawn_url_opener(url).map_err(SystemCommandError::Open)
}

#[cfg(test)]
mod tests {
    use super::{validate_external_url, SystemCommandError};

    #[test]
    fn validate_external_url_accepts_mermaid_docs() {
        assert_eq!(
            validate_external_url(" https://mermaid.js.org/intro/syntax-reference.html ")
                .expect("Mermaid docs URL should be allowed"),
            "https://mermaid.js.org/intro/syntax-reference.html"
        );
    }

    #[test]
    fn validate_external_url_rejects_other_hosts() {
        let error =
            validate_external_url("https://example.com").expect_err("other hosts should fail");

        assert!(matches!(error, SystemCommandError::UrlNotAllowed));
        assert_eq!(error.to_string(), "External URL is not allowed.");
    }
}
