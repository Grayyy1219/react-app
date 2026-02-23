import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./css/global.css";
import App from "./App.tsx";

createRoot(document.getElementById("dom")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
