use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::env;

#[derive(Serialize)]
struct AskAIResult {
    reply: String,
    usage: UsageResult,
}

#[derive(Serialize)]
struct UsageResult {
    input_tokens: u64,
    cached_input_tokens: u64,
    output_tokens: u64,
}

#[tauri::command]
async fn ask_chatgpt(messages: Vec<Value>, model: String) -> Result<AskAIResult, String> {
    let api_key = env::var("OPENAI_API_KEY").map_err(|_| "OPENAI_API_KEY not set".to_string())?;

    let client = Client::new();

    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "input": messages
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid JSON response: {}", e))?;

    if !status.is_success() {
        return Err(format!("OpenAI error: {}", body));
    }

    let reply = body
        .get("output")
        .and_then(|o| o.as_array())
        .and_then(|output| output.first())
        .and_then(|item| item.get("content"))
        .and_then(|c| c.as_array())
        .and_then(|content| content.first())
        .and_then(|part| part.get("text"))
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();

    let input_tokens = body
        .get("usage")
        .and_then(|u| u.get("input_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let cached_input_tokens = body
        .get("usage")
        .and_then(|u| u.get("input_tokens_details"))
        .and_then(|d| d.get("cached_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let output_tokens = body
        .get("usage")
        .and_then(|u| u.get("output_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    Ok(AskAIResult {
        reply,
        usage: UsageResult {
            input_tokens,
            cached_input_tokens,
            output_tokens,
        },
    })
}

#[tauri::command]
async fn ask_claude(messages: Vec<Value>, model: String) -> Result<AskAIResult, String> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY is not set".to_string())?
        .trim()
        .to_string();

    let client = Client::new();

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": model,
            "max_tokens": 8096,
            "messages": messages
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {:?}", e))?;

    let status = response.status();

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid JSON response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Anthropic error: {}", body));
    }

    let reply = body
        .get("content")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|item| item.get("text"))
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();

    let input_tokens = body
        .get("usage")
        .and_then(|u| u.get("input_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let cached_input_tokens = body
        .get("usage")
        .and_then(|u| u.get("cache_read_input_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let output_tokens = body
        .get("usage")
        .and_then(|u| u.get("output_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    Ok(AskAIResult {
        reply,
        usage: UsageResult {
            input_tokens,
            cached_input_tokens,
            output_tokens,
        },
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![ask_chatgpt, ask_claude])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

}
