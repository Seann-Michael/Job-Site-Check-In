import "./global.css";
import { createRoot } from "react-dom/client";
import App from "./App";

// Suppress ResizeObserver loop completed error (harmless but annoying)
// This is a known issue with Radix UI and other component libraries
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('ResizeObserver loop completed with undelivered notifications')
    ) {
      // Silently ignore this specific error
      return;
    }
    originalError.apply(console, args);
  };
}

// Mount the React app
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
} else {
  console.error("Root element not found!");
}
