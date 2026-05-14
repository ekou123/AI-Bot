import { useState, useEffect } from "react";
import { getSetting, setSetting } from "../db";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsPanel({ isOpen, onClose }: Props) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [saved, setSaved] = useState(false);


  

  useEffect(() => {
    if (!isOpen) return;
    getSetting("openai_api_key").then(v => setOpenaiKey(v ?? ""));
    getSetting("anthropic_api_key").then(v => setAnthropicKey(v ?? ""));
    getSetting("tavily_api_key").then(v => setTavilyKey(v ?? ""));
    getSetting("gemini_api_key").then(v => setGeminiKey(v ?? ""));
  }, [isOpen]);

  async function handleSave() {
    await setSetting("openai_api_key", openaiKey.trim());
    await setSetting("anthropic_api_key", anthropicKey.trim());
    await setSetting("gemini_api_key", geminiKey.trim());
    await setSetting("tavily_api_key", tavilyKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">API Keys</h2>
          <button className="delete-button" onClick={onClose}>✕</button>
        </div>

        <div className="settings-field">
          <label className="section-label">OpenAI API Key</label>
          <input
            className="settings-input"
            type="password"
            placeholder="sk-..."
            value={openaiKey}
            onChange={e => setOpenaiKey(e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="section-label">Anthropic API Key</label>
          <input
            className="settings-input"
            type="password"
            placeholder="sk-ant-..."
            value={anthropicKey}
            onChange={e => setAnthropicKey(e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="section-label">Gemini API Key</label>
          <input
            className="settings-input"
            type="password"
            placeholder="AIza..."
            value={geminiKey}
            onChange={e => setGeminiKey(e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="section-label">Tavily API Key</label>
          <input
            className="settings-input"
            type="password"
            placeholder="tvly-..."
            value={tavilyKey}
            onChange={e => setTavilyKey(e.target.value)}
          />
        </div>

        

        <div className="actions">
          <button className="send-button" onClick={handleSave}>
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
