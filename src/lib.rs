use serde_json::json;

#[tauri::command]
async fn ask_chatgpt(prompt: String) -> Result<String, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY is not set".to_string())?;

    let client = reqwest::Client::new();

    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&json!({
            "model": "gpt-4.1",
            "input": prompt
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(body.to_string());
    }

    body["output_text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Unexpected response: {}", body))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ask_chatgpt])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}