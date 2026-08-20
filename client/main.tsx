import "./global.css";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initAuth } from "./lib/auth";
import { workspaceService } from "./lib/workspaceService";
import { initSentry } from "./lib/errorHandling";

// Error reporting — no-op unless VITE_SENTRY_DSN is set.
void initSentry();

async function bootstrap() {
  // Populate the auth cache from the Supabase session before first paint so
  // getCurrentUser() is synchronously available and ProtectedRoute doesn't
  // flash the login screen for an already-authenticated user.
  await initAuth();

  // Link Supabase UUID ↔ sub_account_id ↔ businesses once a session exists.
  // (initAuth already kicks this off when a session is present; awaiting here
  // makes business scoping ready before the first protected render.)
  await workspaceService.initialize().catch(console.error);

  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  } else {
    console.error("Root element not found!");
  }
}

void bootstrap();
