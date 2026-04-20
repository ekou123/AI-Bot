import { useState, useEffect } from "react";
import { getSetting, setSetting } from "../db";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsPanel({ isOpen, onClose }: Props) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getSetting("openai_api_key").then(v => setOpenaiKey(v ?? ""));
    getSetting("anthropic_api_key").then(v => setAnthropicKey(v ?? ""));
  }, [isOpen]);

  async function handleSave() {
    await setSetting("openai_api_key", openaiKey.trim());
    await setSetting("anthropic_api_key", anthropicKey.trim());
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

        <div className="actions">
          <button className="send-button" onClick={handleSave}>
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
