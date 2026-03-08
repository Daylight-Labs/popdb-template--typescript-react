import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.tsx";

const requiredEnv = [
  "VITE_API_URL",
  "VITE_AUTH_URL",
  "VITE_ENVIRONMENT",
  "VITE_APP_ID",
] as const;

const missing = requiredEnv.filter(
  (key) => !import.meta.env[key]
);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}.\n` +
    `Check your .env.staging or .env.production file.`
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
