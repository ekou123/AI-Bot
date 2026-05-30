type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
};

export function HomeInputBar({ value, onChange, onSend }: Props) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="home-input-bar">
      <div className="home-input-box">
        <button className="home-input-attach" title="Attach file">📎</button>
        <textarea
          className="home-input-textarea"
          placeholder="Ask anything, or choose a feature above..."
          rows={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="home-input-right">
          <select className="home-input-model">
            <option>GPT-4o</option>
            <option>Claude Sonnet</option>
            <option>Gemini 2.5 Pro</option>
          </select>
          <button className="home-input-send" title="Send" onClick={onSend}>↑</button>
        </div>
      </div>
      <div className="home-input-footer">Press Enter to send · Shift + Enter for new line</div>
    </div>
  );
}
