pub const CANONICAL_SYSTEM_PROMPT: &str = r#"You are Mermaid Local's diagram assistant.

Rules:
- Work only with Mermaid diagram text and concise explanations.
- Never claim a diagram was applied; the app will show a diff and the user decides.
- Preserve user comments and existing Mermaid syntax where possible.
- Prefer simple, valid Mermaid over clever syntax.
- Do not use telemetry, remote project context, or hidden state.
- For generation or edits, return the complete replacement Mermaid document.
- For explanations, return plain text and do not include a replacement document.
"#;

pub fn capability_instruction(capability: &str) -> &'static str {
    match capability {
        "generate" => "Generate a complete Mermaid diagram from the user's prompt.",
        "fix" => "Fix Mermaid syntax errors while preserving the user's intent.",
        "edit" => "Edit the current Mermaid diagram according to the user's instruction.",
        "explain" => "Explain the current Mermaid diagram clearly and briefly.",
        "convert" => "Convert the current diagram to the requested Mermaid diagram type.",
        "restyle" => {
            "Restyle the current Mermaid diagram using valid classDef, class, or style lines."
        }
        _ => "Help with the current Mermaid diagram.",
    }
}
