import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { createBot, Workspace, type SavedChat } from "./lib/providers/types";
import type { ChatUpdatePayload } from "./ChatWindow";
import { listen, emit } from "@tauri-apps/api/event";
import { getDB, setupDB, deleteHistoryChat, getFavouriteChats, setFavouriteChat, removeFavouriteChat } from "./db";
import { ModelKey } from "./lib/models";
import { useBots } from "./hooks/botCommands";
import { useWindowManager } from "./hooks/useWindowManager";
import { SettingsPanel } from "./components/SettingsPanel";
import App from "./App";
import { MainCanvas } from "./components/MainCanvas";
import { WorkspacesCanvas } from "./components/workspaces/WorkspacesCanvas";

type View =
  | { type: "home" }
  | { type: "workspace"; workspace: Workspace };

export function AppShell() {
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [favouriteIds, setFavouriteIds] = useState<number[]>([]);
  const [view, setView] = useState<View>({ type: "home" });

  const { bots, setBots, setNextId, addBot, updateBot, focusBot, deleteBot, askBot, renameBot, summariseBot, sliceAIChat, runResearchAgent } =
    useBots(setSavedChats, setSessionTotal);

  const { pendingInits, popOutBot, reopenChat } =
    useWindowManager(bots, setBots, focusBot);

  const NAV_HANDLERS: Partial<Record<string, () => void>> = {
    Home: () => setView({ type: "home" }),
    Settings: () => setSettingsOpen(true),
  };

  function handleNavigate(page: string) {
    NAV_HANDLERS[page]?.();
  }

  function renderMain() {
    switch (view.type) {
      case "workspace":
        return (
          <WorkspacesCanvas
            workspace={view.workspace}
            savedChats={savedChats}
            sessionTotal={sessionTotal}
            onNewChat={addBot}
            onClose={() => setView({ type: "home" })}
            onReopenChat={reopenChat}
          />
        );
      case "home":
      default:
        return (
          <MainCanvas
            savedChats={savedChats}
            sessionTotal={sessionTotal}
            onNewChat={addBot}
            onReopenChat={reopenChat}
            onOpenWorkspace={(ws) => setView({ type: "workspace", workspace: ws })}
          />
        );
    }
  }

  useEffect(() => {
    setupDB().then(async (db) => {
      const rows = await db.select<{ id: number; title: string; model: string; messages: string; updated_at: number }[]>(
        "SELECT * FROM chats ORDER BY updated_at DESC"
      );

      if (rows.length === 0) {
        setBots([createBot(1)]);
        setNextId(2);
      } else {
        setNextId(Math.max(...rows.map(r => r.id)) + 1);
      }

      setSavedChats(rows.map(r => ({ ...r, model: r.model as ModelKey, messages: JSON.parse(r.messages), updated_at: r.updated_at })));
      const favIds = await getFavouriteChats();
      setFavouriteIds(favIds);
    });

    const unlistenReady = listen<{ label: string }>("chat:ready", (event) => {
      const { label } = event.payload;
      const pending = pendingInits.current.get(label);
      if (pending) {
        pendingInits.current.delete(label);
        emit("chat:init", { label, title: pending.title, model: pending.model, messages: pending.messages });
      }
    });

    const unlistenRename = listen<{ id: number; title: string }>("chat:rename", (event) => {
      const { id, title } = event.payload;
      renameBot(id, title);
    });

    const unlistenPopIn = listen<ChatUpdatePayload>("chat:popin", (event) => {
      const { id, title, model, messages } = event.payload;
      setBots(prev => {
        if (prev.some(b => b.id === id)) return prev;
        return [...prev, { ...createBot(id), title, model, messages }];
      });
    });

    const unlistenUpdate = listen<ChatUpdatePayload>("chat:update", (event) => {
      const { id, title, model, messages } = event.payload;
      getDB().execute(
        `INSERT INTO chats (id, title, model, messages, updated_at)
         VALUES ($1, $2, $3, $4, unixepoch())
         ON CONFLICT(id) DO UPDATE SET title=$2, model=$3, messages=$4, updated_at=unixepoch()`,
        [id, title, model, JSON.stringify(messages)]
      );
      setSavedChats(prev => {
        const existing = prev.findIndex(c => c.id === id);
        const updated: SavedChat = { id, title, model, messages, updated_at: Date.now() / 1000 };
        if (existing !== -1) {
          const copy = [...prev];
          copy[existing] = updated;
          return copy;
        }
        return [...prev, updated];
      });
    });

    return () => {
      unlistenReady.then(fn => fn());
      unlistenPopIn.then(fn => fn());
      unlistenUpdate.then(fn => fn());
      unlistenRename.then(fn => fn());
    };
  }, []);

  async function handleDeleteHistoryChat(id: number) {
    await deleteHistoryChat(id);
    setSavedChats(prev => prev.filter(c => c.id !== id));
  }

  async function handleToggleFavourite(id: number) {
    if (favouriteIds.includes(id)) {
      await removeFavouriteChat(id);
      setFavouriteIds(prev => prev.filter(f => f !== id));
    } else {
      await setFavouriteChat(id);
      setFavouriteIds(prev => [...prev, id]);
    }
  }

  return (
    <div className="app-shell">

      {/* Full-width top header */}
      <header className="app-top-header">
        <div className="app-top-logo">
          <span className="app-top-logo-icon">⭐</span>
          <span className="app-top-logo-text">AI Workspace</span>
        </div>
        <div className="app-top-search">
          <span className="app-top-search-icon">🔍</span>
          <input className="app-top-search-input" placeholder="Search anything..." />
          <kbd className="app-top-search-kbd">Ctrl K</kbd>
        </div>
        <div className="app-top-actions">
          <button className="app-top-new-btn" onClick={addBot}>+ New</button>
          <button className="app-top-icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">⚙</button>
          <button className="app-top-icon-btn" title="Theme">○</button>
          <button className="app-top-icon-btn" title="Notifications">🔔</button>
          <div className="app-top-avatar">E</div>
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          savedChats={savedChats}
          bots={bots}
          onNewChat={addBot}
          onReopenChat={reopenChat}
          onDeleteHistoryChat={handleDeleteHistoryChat}
          favouriteIds={favouriteIds}
          onToggleFavourite={handleToggleFavourite}
          onNavigate={handleNavigate}
        />

        <div className="workspace">
          {renderMain()}
        </div>
      </div>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <App
        bots={bots}
        onUpdate={updateBot}
        onAsk={askBot}
        onFocus={focusBot}
        onDelete={deleteBot}
        onPopOut={popOutBot}
        onRename={renameBot}
        onSummarise={summariseBot}
        onSlice={sliceAIChat}
        onRunAsAgent={runResearchAgent}
      />
    </div>
  );
}
