import { invoke } from "@tauri-apps/api/core";

export async function sendMessage(prompt: string) {
  const reply = await invoke<string>("ask_chatgpt", { prompt });
  return reply;
}