import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

export default function App() {
  const [leftPrompt, setLeftPrompt] = useState("");
  const [rightPrompt, setRightPrompt] = useState("");
  const [leftReply, setLeftReply] = useState("");
  const [rightReply, setRightReply] = useState("");
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);

  async function askLeft() {
    if (!leftPrompt.trim()) return;

    setLeftLoading(true);
    try {
      const result = await invoke<string>("ask_chatgpt", { prompt: leftPrompt });
      setLeftReply(result);
    } catch (err) {
      setLeftReply(String(err));
    } finally {
      setLeftLoading(false);
    }
  }

  async function askRight() {
    if (!rightPrompt.trim()) return;

    setRightLoading(true);
    try {
      const result = await invoke<string>("ask_chatgpt", { prompt: rightPrompt });
      setRightReply(result);
    } catch (err) {
      setRightReply(String(err));
    } finally {
      setRightLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="background-glow glow-1" />
      <div className="background-glow glow-2" />

      <div className="chat-layout">
        <section className="chat-card">
          <div className="topbar">
            <div>
              <p className="eyebrow">Desktop AI Assistant</p>
              <h1>Left Bot</h1>
            </div>
            <div className="status-pill">
              <span className="status-dot" />
              Ready
            </div>
          </div>

          <p className="subtitle">Left-side model panel.</p>

          <div className="input-section">
            <label htmlFor="left-prompt" className="section-label">
              Ask something
            </label>
            <textarea
              id="left-prompt"
              value={leftPrompt}
              onChange={(e) => setLeftPrompt(e.target.value)}
              rows={7}
              placeholder="Type your message here..."
              className="prompt-box"
            />
          </div>

          <div className="actions">
            <button onClick={askLeft} disabled={leftLoading} className="send-button">
              {leftLoading ? "Thinking..." : "Send message"}
            </button>
          </div>

          <div className="reply-section">
            <div className="reply-header">
              <span className="section-label">Response</span>
            </div>

            <div className="reply-box">
              {leftReply ? (
                <pre>{leftReply}</pre>
              ) : (
                <p className="placeholder-text">Your response will appear here.</p>
              )}
            </div>
          </div>
        </section>

        <section className="chat-card">
          <div className="topbar">
            <div>
              <p className="eyebrow">Desktop AI Assistant</p>
              <h1>Right Bot</h1>
            </div>
            <div className="status-pill">
              <span className="status-dot" />
              Ready
            </div>
          </div>

          <p className="subtitle">Right-side model panel.</p>

          <div className="input-section">
            <label htmlFor="right-prompt" className="section-label">
              Ask something
            </label>
            <textarea
              id="right-prompt"
              value={rightPrompt}
              onChange={(e) => setRightPrompt(e.target.value)}
              rows={7}
              placeholder="Type your message here..."
              className="prompt-box"
            />
          </div>

          <div className="actions">
            <button onClick={askRight} disabled={rightLoading} className="send-button">
              {rightLoading ? "Thinking..." : "Send message"}
            </button>
          </div>

          <div className="reply-section">
            <div className="reply-header">
              <span className="section-label">Response</span>
            </div>

            <div className="reply-box">
              {rightReply ? (
                <pre>{rightReply}</pre>
              ) : (
                <p className="placeholder-text">Your response will appear here.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}