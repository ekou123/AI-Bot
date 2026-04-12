import { Resizable } from "re-resizable";
import { MODEL_INFO, MODEL_OPTIONS, type ModelKey } from "../lib/models";
import type { BotPanel } from "../lib/providers/types";
import { useState } from "react";
import { useRef } from "react";


type Props = {
  bot: BotPanel;
  onUpdate: (updates: Partial<BotPanel>) => void;
  onAsk: () => void;
  onFocus: () => void;
  onDelete: () => void;
};


export function ChatCard({ bot, onUpdate, onAsk, onFocus, onDelete }: Props) {
  const selectedModel = MODEL_INFO[bot.model];
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0 });


  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    onFocus();

    dragOffset.current = {
      x: e.clientX - bot.x,
      y: e.clientY - bot.y,
    };

    function onMouseMove(moveEvent: MouseEvent) {
      onUpdate({
        x: moveEvent.clientX - dragOffset.current.x,
        y: moveEvent.clientY - dragOffset.current.y,
      });
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <Resizable
      defaultSize={{ width: 400, height: 500 }}
      minWidth={600}
      maxWidth={1000}
      enable={{
        left: true, right: true, top: true, bottom: true,
        topLeft: true, topRight: true, bottomLeft: true, bottomRight: true,
      }}
      style={{
        position: "absolute",
        left: bot.x,
        top: bot.y,
        zIndex: bot.zIndex,
      }}
      onResizeStart={() => {
        resizeStart.current = {x: bot.x, y: bot.y}
      }
      }
      onResize={(e, direction, ref, delta) => {
        if (direction === "top" || direction === "topLeft" || direction === "topRight") {
          onUpdate({ y: resizeStart.current.y - delta.height });
        }
        if (direction === "left" || direction === "bottomLeft" || direction === "topLeft") {
          onUpdate({ x: resizeStart.current.x - delta.width });
        }
      }}

    >
      <section className="chat-card" 
      onMouseDown={onFocus}>
        
        <div className="topbar"
        onMouseDown={handleMouseDown}>
          <div className="topbar-left">
            <button onClick={onDelete} className="delete-button">Delete</button>
            <h1>{bot.title}</h1>
            <div className="topbar-meta">
              <div className="chat-cost-card">
                <span className="chat-cost-label">Chat total</span>
                <span className="chat-cost-value">${bot.spent.toFixed(4)}</span>
              </div>
              <div className="chat-cost-card">
                <span className="chat-cost-label">Last msg</span>
                <span className="chat-cost-value">${bot.lastMessageCost.toFixed(6)}</span>
              </div>
            </div>
          </div>
          <div className="status-pill">
            <span className="status-dot" />
            {bot.loading ? "Thinking..." : "Ready"}
          </div>
        </div>

        <p className="subtitle">Choose a model and send a prompt.</p>

        <div className="model-price-banner">
          <div className="model-price-name">{selectedModel.label}</div>
          <div className="model-price-details">
            <span>Input: {selectedModel.inputPriceText}</span>
            <span>Output: {selectedModel.outputPriceText}</span>
          </div>
        </div>

        <div className="input-section">
          <select
            id={`model-${bot.id}`}
            className="selectAIModel"
            value={bot.model}
            onChange={(e) => onUpdate({ model: e.target.value as ModelKey })}
          >
            {MODEL_OPTIONS.map((model) => (
              <option key={model} value={model}>
                {MODEL_INFO[model].label}
              </option>
            ))}
          </select>

          <span className="section-label">Response</span>
          <div className="reply-box">
            {bot.reply ? (
              <pre>{bot.reply}</pre>
            ) : (
              <p className="placeholder-text">Your response will appear here.</p>
            )}
          </div>
        </div>

        <div className="reply-section">
          <div className="actions" style={{ marginTop: 0 }}>
            <textarea
              id={`prompt-${bot.id}`}
              value={bot.prompt}
              onChange={(e) => onUpdate({ prompt: e.target.value })}
              placeholder="Type your message here..."
              className="prompt-box"
            />
          </div>
          <div className="actions">
            <button onClick={onAsk} disabled={bot.loading} className="send-button">
              {bot.loading ? "Thinking..." : "Send"}
            </button>
          </div>
        </div>
      </section>
    </Resizable>
  );
}