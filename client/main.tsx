import "./global.css";
import { createRoot } from "react-dom/client";
import App from "./App";
import { workspaceService } from "./lib/workspaceService";
import { initSentry } from "./lib/errorHandling";

// Error reporting — no-op unless VITE_SENTRY_DSN is set.
void initSentry();

// Initialize workspace (links Supabase UUID ↔ sub_account_id ↔ businesses)
// Non-blocking — runs in background so it doesn't delay first paint
workspaceService.initialize().catch(console.error);

// Mount the React app
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
} else {
  console.error("Root element not found!");
}
