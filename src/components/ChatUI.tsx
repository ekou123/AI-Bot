import React, { useEffect, useRef, useState } from "react";
import { Resizable } from "re-resizable";
import { MODEL_INFO, MODEL_OPTIONS, ModelKey } from "../lib/models";
import { Message } from "../lib/providers/types";

type ChatUIProps = {
  title: string;
  model: ModelKey;
  messages: Message[];
  prompt: string;
  systemPrompt: string;
  loading: boolean;
  spent: number;
  isRenaming: boolean;
  onPromptChange: (v: string) => void;
  onSystemPromptChange: (v: string) => void;
  onSend: () => void;
  onModelChange: (m: ModelKey) => void;
  onRename: (title: string) => void;
  onSlice: () => void;
  onSummarise: () => void;
  onSetRenaming: (v: boolean) => void;
  onTopbarMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  headerActions?: React.ReactNode;
  overlayActions?: React.ReactNode;
  responseActions?: React.ReactNode;
  actions?: React.ReactNode;
};

function MessageBubble({ role, content }: { role: string; content: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`message message-${role}`}>
      <button className="message-copy-btn" onClick={handleCopy}>
        {copied ? "✓" : "⎘"}
      </button>
      <pre>{content}</pre>
    </div>
  );
}

export function ChatUI({
  title, model, messages, prompt, systemPrompt, loading, spent,
  isRenaming, onPromptChange, onSystemPromptChange, onSend, onModelChange,
  onRename, onSlice, onSummarise, onSetRenaming, onTopbarMouseDown, headerActions, overlayActions, responseActions, actions
}: ChatUIProps) {
  const selectedModel = MODEL_INFO[model];
  const bottomRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const [responseHeight, setResponseHeight] = useState(300);
  const [promptHeight, setPromptHeight] = useState(80);
  const [showSystem, setShowSystem] = useState(false);
  const MIN_RESPONSE = 100;
  const MAX_RESPONSE = 800;
  const MIN_PROMPT = 60;
  const MAX_PROMPT = 400;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function commitRename() {
    const newName = renameRef.current?.value;
    if (!newName?.trim()) return;
    onRename(newName);
    onSetRenaming(false);
  }

  return (
    
    <section className="chat-card">
      
      {overlayActions}
      <div className="topbar" onMouseDown={onTopbarMouseDown}>
        {headerActions}
        <div className="topbar-left">
          {isRenaming
            ? <input defaultValue={title} autoFocus ref={renameRef}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); }}
              />
            : <h1>{title}</h1>
          }
          <button onClick={() => onSetRenaming(true)} className="delete-button">✎</button>
          <div className="topbar-meta">
            <div className="chat-cost-card">
              <span className="chat-cost-label">Chat total</span>
              <span className="chat-cost-value">${spent.toFixed(4)}</span>
            </div>
          </div>
        </div>
        <div className="status-pill">
          <span className="status-dot" />
          {loading ? "Thinking..." : "Ready"}
        </div>
      </div>

      <div className="model-price-banner">
        <div className="model-price-name">{selectedModel.label}</div>
        <div className="model-price-details">
          <span>Input: {selectedModel.inputPriceText}</span>
          <span>Output: {selectedModel.outputPriceText}</span>
        </div>
      </div>

      <div className="input-section">
        <select
          className="selectAIModel"
          value={model}
          onChange={(e) => onModelChange(e.target.value as ModelKey)}
          onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); onSend(); } }}
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m} value={m}>{MODEL_INFO[m].label}</option>
          ))}
        </select>

        <div className="system-prompt-row">
          <button
            className={`system-toggle-btn${showSystem ? " active" : ""}${systemPrompt ? " has-value" : ""}`}
            onClick={() => setShowSystem(v => !v)}
          >
            System {systemPrompt && !showSystem ? "•" : showSystem ? "▲" : "▼"}
          </button>
        </div>
        {showSystem && (
          <textarea
            className="system-prompt-box"
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="Give this bot a persona, instructions, or constraints..."
            rows={3}
          />
        )}

        <div className="response-header">
          <span className="section-label">Response</span>
          <div className="slice-btns">
            {responseActions}
            
          </div>
        </div>
        
        <Resizable
            size={{ width: "100%", height: responseHeight }}
            enable={{ bottom: true }}
            minHeight={MIN_RESPONSE}
            maxHeight={MAX_RESPONSE}
            onResizeStop={(_e, _dir, _ref, delta) => {
              setResponseHeight(h => Math.max(MIN_RESPONSE, Math.min(MAX_RESPONSE, h + delta.height)));
            }}>
        <div className="reply-box " style={{height: "100%"}}>
          {messages.length === 0 && (
            <p className="placeholder-text">Your response will appear here.</p>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} />
          ))}
          <div ref={bottomRef} />
        </div>
        </Resizable>
      </div>

      

      <div className="reply-section">
        <Resizable
          size={{ width: "100%", height: promptHeight }}
          enable={{ bottom: true }}
          minHeight={MIN_PROMPT}
          maxHeight={MAX_PROMPT}
          handleStyles={{ bottom: { bottom: 0, height: 8, zIndex: 10, cursor: "row-resize" } }}
          onResizeStop={(_e, _dir, _ref, delta) => {
            setPromptHeight(h => Math.max(MIN_PROMPT, Math.min(MAX_PROMPT, h + delta.height)));
          }}
        >
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); onSend(); } }}
            placeholder="Type your message here..."
            className="prompt-box"
            style={{ height: "calc(100% - 8px)", resize: "none" }}
          />
        </Resizable>
        <div className="actions">
          {actions}
          <button onClick={onSend} disabled={loading} className="send-button">
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}
