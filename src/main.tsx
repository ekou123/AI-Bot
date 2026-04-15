import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ChatWindow } from "./ChatWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

const isChatWindow = getCurrentWindow().label.startsWith("chat-");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isChatWindow ? <ChatWindow /> : <App />}
  </React.StrictMode>
);
