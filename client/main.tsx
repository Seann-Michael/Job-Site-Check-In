import "./global.css";
import { createRoot } from "react-dom/client";
import App from "./App";

// Mount the React app
const rootElement = document.getElementById("root")!;
let root = (globalThis as any).__react_root;
if (!root) {
  root = createRoot(rootElement);
  (globalThis as any).__react_root = root;
}
root.render(<App />);
