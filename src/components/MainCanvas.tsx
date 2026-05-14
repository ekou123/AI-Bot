export function MainCanvas() {
  return (
    <main className="main-canvas">

      <div className="main-content">

        {/* Top bar: title, model selector, actions */}
        <div className="main-topbar">
          <div className="main-topbar-left">
            <div className="main-chat-icon">🤖</div>
            <div>
              <div className="main-chat-title">General Assistant <span className="main-chat-chevron">▾</span></div>
              <div className="main-chat-sub">Your everyday AI companion</div>
            </div>
          </div>

          <div className="main-topbar-center">
            <select className="main-model-select">
              <option>GPT-4o</option>
              <option>Claude Sonnet</option>
              <option>Gemini 2.5 Pro</option>
            </select>
          </div>

          <div className="main-topbar-right">
            <button className="main-topbar-action" title="Share">↑</button>
            <button className="main-topbar-action" title="Favourite">★</button>
            <button className="main-topbar-action" title="More">⋯</button>
          </div>
        </div>

        {/* Scrollable messages */}
        <div className="main-body">
          <div className="main-message main-message-user">
            Explain quantum computing in simple terms and give a real-world example.
          </div>

          <div className="main-message main-message-assistant">
            <p>
              Quantum computing uses quantum bits, or qubits, which can exist in multiple states
              at once thanks to a property called superposition. This allows quantum computers to
              process many possibilities simultaneously.
            </p>
            <p>
              Real-world example: Companies like IBM and Google are exploring quantum computers
              to speed up drug discovery by simulating molecular interactions.
            </p>
            <div className="main-message-actions">
              <button title="Copy">⎘</button>
              <button title="Like">👍</button>
              <button title="Dislike">👎</button>
              <button title="Continue">▶</button>
            </div>
          </div>

          {/* Suggested follow-ups */}
          <div className="main-suggestions">
            <button className="main-suggestion-chip">How does superposition work?</button>
            <button className="main-suggestion-chip">What are current limitations?</button>
            <button className="main-suggestion-chip">More examples</button>
            <button className="main-suggestion-refresh">↻</button>
          </div>
        </div>

        {/* Input */}
        <div className="main-input">
          <div className="main-input-box">
            <button className="main-input-attach" title="Attach file">📎</button>
            <textarea
              className="main-input-textarea"
              placeholder="Message General Assistant..."
              rows={1}
            />
            <div className="main-input-actions">
              <button className="main-input-settings" title="Settings">⚙</button>
              <button className="main-input-send" title="Send">↑</button>
            </div>
          </div>
          <div className="main-input-footer">
            Press ⌘/ to focus · Shift + Enter to add a new line
          </div>
        </div>

      </div>

      {/* Right panel */}
      <aside className="right-panel">
        {/* Right panel content */}
      </aside>

    </main>
  );
}
