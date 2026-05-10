import { Resizable } from "re-resizable";
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
  
};




export function ChatCard({ bot, onUpdate, onAsk, onFocus, onDelete, onPopOut, onRename, onSummarise, onSlice }: Props) {
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0 });
  const [isRenaming, setIsRenaming] = useState(false);

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
        position: "fixed",
        left: bot.x,
        top: bot.y,
        zIndex: bot.zIndex,
      }}
      onResizeStart={() => {
        resizeStart.current = { x: bot.x, y: bot.y }
      }
      }
      onResize={(e, direction, ref, delta) => {
        if (direction === "top" || direction === "topLeft" || direction === "topRight") {
          onUpdate({ y: resizeStart.current.y - delta.height });
        }
        if (direction === "left" || direction === "bottomLeft" || direction === "topLeft") {
          onUpdate({ x: resizeStart.current.x - delta.width });
        }
      }}>
      <ChatUI
        title={bot.title}      
        model={bot.model}
        messages={bot.messages}
        prompt={bot.prompt}
        loading={bot.loading}
        spent={bot.spent}
        isRenaming={isRenaming}
        onPromptChange={(v) => onUpdate({ prompt: v })}
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
          </>
        }
      ></ChatUI>
        
      </Resizable>
  )
}