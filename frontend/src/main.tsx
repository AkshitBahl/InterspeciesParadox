import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { wakeBackend } from "./services/live/wakeBackend";
import "./styles/globals.css";
import "./styles/polish.css";
import "./styles/wildlife.css";
import "./styles/motion.css";

wakeBackend();

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);