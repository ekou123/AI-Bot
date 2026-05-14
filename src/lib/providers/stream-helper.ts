import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AskResult } from "./types";

export async function streamViaRust(
  onChunk: (text: string) => void,
  args: {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
    textPath: string[];
  }
): Promise<AskResult> {
  const streamId = Math.random().toString(36).slice(2);

  return new Promise<AskResult>((resolve, reject) => {
    const unlisteners: (() => void)[] = [];
    const cleanup = () => unlisteners.forEach(fn => fn());

    Promise.all([
      listen<string>(`stream:chunk:${streamId}`, e => onChunk(e.payload)),
      listen<void>(`stream:done:${streamId}`, () => {
        cleanup();
        resolve({ reply: "", usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 } });
      }),
      listen<string>(`stream:error:${streamId}`, e => {
        cleanup();
        reject(new Error(e.payload));
      }),
    ]).then(([u1, u2, u3]) => {
      unlisteners.push(u1, u2, u3);
      invoke("stream_ai", { ...args, streamId })
        .catch(err => { cleanup(); reject(err); });
    });
  });
}
