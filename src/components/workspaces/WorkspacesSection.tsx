import { useRef, useState } from "react";
import { PINNED_AGENTS } from "../../data/homeData";
import type { Workspace, WorkspaceFile } from "../../lib/providers/types";

type ModalState = {
  icon: string;
  name: string;
  systemPrompt: string;
  files: WorkspaceFile[];
  agents: string[];
};

const ICON_OPTIONS = ["💼", "📦", "🧪", "💡", "🗂️", "🚀", "🎨", "🔬", "📊", "🤖", "✍️", "🌐"];

const EMPTY_MODAL: ModalState = { icon: "💼", name: "", systemPrompt: "", files: [], agents: [] };

const INITIAL_WORKSPACES: Workspace[] = [
  { id: 1, icon: "📦", name: "Project Alpha",  systemPrompt: "", files: [], agents: [], updatedAt: Date.now() / 1000 - 7200, isFavourite: false },
  { id: 2, icon: "🧪", name: "Research Lab",   systemPrompt: "", files: [], agents: [], updatedAt: Date.now() / 1000 - 86400, isFavourite: false },
  { id: 3, icon: "💡", name: "Brainstorm",     systemPrompt: "", files: [], agents: [], updatedAt: Date.now() / 1000 - 259200, isFavourite: false },
  { id: 4, icon: "🗂️", name: "Client Work",   systemPrompt: "", files: [], agents: [], updatedAt: Date.now() / 1000 - 432000, isFavourite: false },
];

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📕";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "cpp"].includes(ext)) return "💻";
  return "📄";
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function WorkspaceCard({ ws, onOpen, onFavourite }: {
  ws: Workspace;
  onOpen: (ws: Workspace) => void;
  onFavourite: (id: number) => void;
}) {
  return (
    <button className="home-workspace-card" onClick={() => onOpen(ws)}>
      <span className="home-workspace-icon">{ws.icon}</span>
      <div className="home-workspace-info">
        <div className="home-workspace-name">{ws.name}</div>
        <div className="home-workspace-sub">
          {ws.agents.length} agents · {ws.files.length} files · {timeAgo(ws.updatedAt)}
        </div>
      </div>
      <button
        className={`ws-fav-btn${ws.isFavourite ? " ws-fav-btn--active" : ""}`}
        onClick={e => { e.stopPropagation(); onFavourite(ws.id); }}
        title={ws.isFavourite ? "Unfavourite" : "Favourite"}
      >
        ⭐
      </button>
    </button>
  );
}

export function WorkspacesSection({ onOpenWorkspace, variant = "home" }: {
  onOpenWorkspace: (ws: Workspace) => void;
  variant?: "home" | "page";
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(INITIAL_WORKSPACES);
  const [showModal, setShowModal] = useState(false);
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);
  const favourites = workspaces.filter(ws => ws.isFavourite);
  const rest = workspaces.filter(ws => !ws.isFavourite);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextFileId = useRef(0);
  const nextWsId = useRef(INITIAL_WORKSPACES.length + 1);

  function openModal() {
    setModal(EMPTY_MODAL);
    setShowModal(true);
  }

  function handleCreate() {
    if (!modal.name.trim()) return;
    setWorkspaces(prev => [
      {
        id: nextWsId.current++,
        icon: modal.icon,
        name: modal.name.trim(),
        systemPrompt: modal.systemPrompt,
        files: modal.files,
        agents: modal.agents,
        updatedAt: Date.now() / 1000,
        isFavourite: false,
      },
      ...prev,
    ]);
    setShowModal(false);
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setModal(prev => ({
      ...prev,
      files: [...prev.files, ...picked.map(f => ({ id: nextFileId.current++, name: f.name, description: "" }))],
    }));
    e.target.value = "";
  }

  function updateFileDesc(id: number, description: string) {
    setModal(prev => ({ ...prev, files: prev.files.map(f => (f.id === id ? { ...f, description } : f)) }));
  }

  function removeFile(id: number) {
    setModal(prev => ({ ...prev, files: prev.files.filter(f => f.id !== id) }));
  }

  function toggleAgent(name: string) {
    setModal(prev => ({
      ...prev,
      agents: prev.agents.includes(name) ? prev.agents.filter(a => a !== name) : [...prev.agents, name],
    }));
  }

  function toggleFavourite(id: number) {
    setWorkspaces(prev => 
      prev.map(ws => ws.id === id ? { ...ws, isFavourite: !ws.isFavourite} : ws)
    );
  }

  return (
    <>
      {variant === "page" ? (
        <>
          {/* Favourite Workspaces — always visible on the page */}
          <div className="home-section">
            <div className="home-section-header">
              <span className="home-section-title">Favourite Workspaces</span>
            </div>
            {favourites.length === 0
              ? <p className="ws-empty">No favourite workspace card to display.</p>
              : <div className="home-workspace-grid">
                  {favourites.map(ws => (
                    <WorkspaceCard key={ws.id} ws={ws} onOpen={onOpenWorkspace} onFavourite={toggleFavourite} />
                  ))}
                </div>
            }
          </div>

          {/* All Workspaces — every workspace */}
          <div className="home-section">
            <div className="home-section-header">
              <span className="home-section-title">All Workspaces</span>
              <button className="home-view-all" onClick={openModal}>+ New</button>
            </div>
            <div className="home-workspace-grid">
              {workspaces.map(ws => (
                <WorkspaceCard key={ws.id} ws={ws} onOpen={onOpenWorkspace} onFavourite={toggleFavourite} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="home-section">
          {favourites.length > 0 && (
            <>
              <div className="home-section-header">
                <span className="home-section-title">⭐ Favourites</span>
              </div>
              <div className="home-workspace-grid">
                {favourites.map(ws => (
                  <WorkspaceCard key={ws.id} ws={ws} onOpen={onOpenWorkspace} onFavourite={toggleFavourite} />
                ))}
              </div>
            </>
          )}
          <div className="home-section-header">
            <span className="home-section-title">All Workspaces</span>
            <button className="home-view-all" onClick={openModal}>+ New</button>
          </div>
          <div className="home-workspace-grid">
            {rest.map(ws => (
              <WorkspaceCard key={ws.id} ws={ws} onOpen={onOpenWorkspace} onFavourite={toggleFavourite} />
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="ws-overlay" onClick={() => setShowModal(false)}>
          <div className="ws-modal" onClick={e => e.stopPropagation()}>

            <div className="ws-modal-header">
              <span className="ws-modal-title">New Workspace</span>
              <button className="ws-modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            {/* Icon + Name */}
            <div className="ws-modal-name-row">
              <div className="ws-icon-picker">
                {ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    className={`ws-icon-opt${modal.icon === icon ? " ws-icon-opt--active" : ""}`}
                    onClick={() => setModal(prev => ({ ...prev, icon }))}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <input
                className="ws-name-input"
                placeholder="Workspace name"
                value={modal.name}
                onChange={e => setModal(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Context */}
            <label className="ws-label">Context</label>
            <textarea
              className="ws-textarea"
              placeholder="What should the AI know about this workspace? (system prompt)"
              value={modal.systemPrompt}
              onChange={e => setModal(prev => ({ ...prev, systemPrompt: e.target.value }))}
            />

            {/* Files */}
            <div className="ws-section-header">
              <label className="ws-label">Files</label>
              <button className="ws-add-btn" onClick={() => fileInputRef.current?.click()}>+ Add File</button>
              <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFilePick} />
            </div>
            {modal.files.length === 0
              ? <p className="ws-empty">No files added yet.</p>
              : modal.files.map(f => (
                  <div key={f.id} className="ws-file-row">
                    <span className="ws-file-icon">{fileIcon(f.name)}</span>
                    <span className="ws-file-name">{f.name}</span>
                    <input
                      className="ws-file-desc"
                      placeholder="Instructions for this file..."
                      value={f.description}
                      onChange={e => updateFileDesc(f.id, e.target.value)}
                    />
                    <button className="ws-file-remove" onClick={() => removeFile(f.id)}>×</button>
                  </div>
                ))
            }

            {/* Agents */}
            <label className="ws-label">Agents</label>
            <div className="ws-agent-chips">
              {PINNED_AGENTS.map(agent => {
                const active = modal.agents.includes(agent.name);
                return (
                  <button
                    key={agent.name}
                    className={`ws-agent-chip${active ? " ws-agent-chip--active" : ""}`}
                    style={active ? { borderColor: agent.color, color: agent.color, background: agent.color + "22" } : {}}
                    onClick={() => toggleAgent(agent.name)}
                  >
                    {agent.icon} {agent.name}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="ws-modal-actions">
              <button className="ws-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="ws-create" onClick={handleCreate} disabled={!modal.name.trim()}>
                Create Workspace
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
