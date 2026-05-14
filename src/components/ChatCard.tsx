import type { BotPanel } from "../lib/providers/types";
import { useState, useRef } from "react";
import { ChatUI } from "./ChatUI";

type Props = {
  bot: BotPanel;
  onUpdate: (updates: Partial<BotPanel>) => void;
  onAsk: () => void;
  onFocus: () => void;
  onDelete: () => void;
  onPopOut: () => void;
  onRename: (newTitle: string) => void;
  onSummarise: () => void;
  onSlice: () => void;
  onRunAsAgent: () => void;
};

const MIN_WIDTH = 300;
const MAX_WIDTH = 1000;

export function ChatCard({ bot, onUpdate, onAsk, onFocus, onDelete, onPopOut, onRename, onSummarise, onSlice, onRunAsAgent }: Props) {
  const dragOffset = useRef({ x: 0, y: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [width, setWidth] = useState(400);
  const widthRef = useRef(400);

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

  function handleResize(e: React.MouseEvent, left: boolean) {
    e.preventDefault();
    onFocus();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    const startBotX = bot.x;

    function onMouseMove(moveEvent: MouseEvent) {
      const delta = left
        ? startX - moveEvent.clientX
        : moveEvent.clientX - startX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
      widthRef.current = newWidth;
      setWidth(newWidth);
      if (left) onUpdate({ x: startBotX - (newWidth - startWidth) });
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      style={{
        position: "fixed",
        left: bot.x,
        top: bot.y,
        zIndex: bot.zIndex,
        width,
      }}
      className="chat-card-outer"
    >
      
      <div className="chat-card-resize-handle chat-card-resize-left"  onMouseDown={(e) => handleResize(e, true)} />
      <div className="chat-card-resize-handle chat-card-resize-right" onMouseDown={(e) => handleResize(e, false)} />
      <ChatUI
        title={bot.title}
        model={bot.model}
        messages={bot.messages}
        prompt={bot.prompt}
        loading={bot.loading}
        spent={bot.spent}
        isRenaming={isRenaming}
        onPromptChange={(v) => onUpdate({ prompt: v })}
        onSystemPromptChange={(v) => onUpdate({ systemPrompt: v })}
        systemPrompt={bot.systemPrompt}
        onSend={onAsk}
        onModelChange={(m) => onUpdate({ model: m })}
        onRename={onRename}
        onSlice={onSlice}
        onSummarise={onSummarise}
        onSetRenaming={setIsRenaming}
        onTopbarMouseDown={handleMouseDown}
        overlayActions={<button className="topbar-btn" onClick={onDelete}>x</button>}
        headerActions={<button onClick={onPopOut} className="delete-button">Pop out</button>}
        responseActions={
          <>
            <button onClick={onSlice} className="slice-btn">Slice</button>
            <button onClick={onSummarise} className="slice-btn">Summarise</button>
          </>
        }
        actions={
          <>
            <button className="topbar-btn" onClick={onDelete}>x</button>
            <button onClick={onPopOut} className="delete-button">Pop out</button>
            <button onClick={onRunAsAgent} className="delete-button">→ Agent</button>
          </>
        }
      />
      
    </div>
  );
}
