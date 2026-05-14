use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Serialize)]
struct ToolCallItem {
    id: String,
    name: String,
    input: Value,
}

#[derive(Serialize)]
struct AgentStepResult {
    done: bool,
    reply: String,
    tool_calls: Vec<ToolCallItem>,
    assistant_content: Value,
    usage: UsageResult,
}

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

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";

#[tauri::command]
async fn ask_chatgpt(messages: Vec<Value>, model: String, api_key: String) -> Result<AskAIResult, String> {

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
async fn ask_claude(messages: Vec<Value>, model: String, api_key: String) -> Result<AskAIResult, String> {

    let client = Client::new();

    let response = client
        .post(ANTHROPIC_URL)
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

#[tauri::command]
async fn ask_claude_agent(
    messages: Vec<Value>,
    tools: Vec<Value>,
    model: String,
    api_key: String,
) -> Result<AgentStepResult, String> {
    let client = Client::new();

    let response = client
        .post(ANTHROPIC_URL)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": model,
            "max_tokens": 8096,
            "tools": tools,
            "messages": messages
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
        return Err(format!("Anthropic error: {}", body));
    }

    let content = body.get("content")
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default();

    let stop_reason = body.get("stop_reason")
        .and_then(|s| s.as_str())
        .unwrap_or("end_turn");

    let input_tokens = body.get("usage").and_then(|u| u.get("input_tokens")).and_then(|v| v.as_u64()).unwrap_or(0);
    let cached_input_tokens = body.get("usage").and_then(|u| u.get("cache_read_input_tokens")).and_then(|v| v.as_u64()).unwrap_or(0);
    let output_tokens = body.get("usage").and_then(|u| u.get("output_tokens")).and_then(|v| v.as_u64()).unwrap_or(0);
    let usage = UsageResult { input_tokens, cached_input_tokens, output_tokens };

    if stop_reason == "tool_use" {
        let tool_calls: Vec<ToolCallItem> = content.iter()
            .filter(|block| block.get("type").and_then(|t| t.as_str()) == Some("tool_use"))
            .map(|block| ToolCallItem {
                id: block.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                name: block.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                input: block.get("input").cloned().unwrap_or(Value::Null),
            })
            .collect();

        Ok(AgentStepResult {
            done: false,
            reply: String::new(),
            tool_calls,
            assistant_content: Value::Array(content),
            usage,
        })
    } else {
        let reply = content.iter()
            .filter(|block| block.get("type").and_then(|t| t.as_str()) == Some("text"))
            .filter_map(|block| block.get("text").and_then(|t| t.as_str()))
            .collect::<Vec<&str>>()
            .join("\n");

        Ok(AgentStepResult {
            done: true,
            reply,
            tool_calls: vec![],
            assistant_content: Value::Array(content),
            usage,
        })
    }
}

#[tauri::command]
async fn web_search(query: String, api_key: String) -> Result<String, String> {
    let client = Client::new();

    let response = client
        .post("https://api.tavily.com/search")
        .json(&json!({
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": 5,
            "include_answer": true
        }))
        .send()
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    let status = response.status();
    let body: Value = response.json().await
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    if !status.is_success() {
        return Err(format!("Tavily error: {}", body));
    }

    let mut result = String::new();

    if let Some(answer) = body.get("answer").and_then(|a| a.as_str()) {
        result.push_str(&format!("Summary: {}\n\n", answer));
    }

    if let Some(results) = body.get("results").and_then(|r| r.as_array()) {
        for (i, item) in results.iter().enumerate() {
            let title   = item.get("title").and_then(|t| t.as_str()).unwrap_or("No title");
            let url     = item.get("url").and_then(|u| u.as_str()).unwrap_or("");
            let content = item.get("content").and_then(|c| c.as_str()).unwrap_or("");
            result.push_str(&format!("[{}] {}\n{}\n{}\n\n", i + 1, title, url, content));
        }
    }

    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![ask_chatgpt, ask_claude, ask_claude_agent, web_search])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

}
