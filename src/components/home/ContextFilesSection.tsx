import { useRef, useState } from "react";

type ContextFile = {
  id: number;
  name: string;
  description: string;
};

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📕";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "cpp", "c"].includes(ext)) return "💻";
  return "📄";
}

export function ContextFilesSection() {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setFiles(prev => [
      ...prev,
      ...picked.map(f => ({ id: nextId.current++, name: f.name, description: "" })),
    ]);
    e.target.value = "";
  }

  function updateDescription(id: number, description: string) {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, description } : f)));
  }

  function removeFile(id: number) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  return (
    <div className="home-section">
      <div className="home-section-header">
        <span className="home-section-title">Context Files</span>
        <button className="home-view-all" onClick={() => inputRef.current?.click()}>
          + Add File
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleFilePick}
        />
      </div>

      <div className="home-context-list">
        {files.length === 0 && (
          <div className="home-chats-empty">
            No files yet — add one to give the AI extra context.
          </div>
        )}
        {files.map(f => (
          <div key={f.id} className="home-context-card">
            <div className="home-context-card-header">
              <span className="home-context-icon">{fileIcon(f.name)}</span>
              <span className="home-context-name">{f.name}</span>
              <button className="home-context-remove" onClick={() => removeFile(f.id)}>×</button>
            </div>
            <input
              className="home-context-desc"
              placeholder="What should the AI do with this file?"
              value={f.description}
              onChange={e => updateDescription(f.id, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
