import "./global.css";
import { createRoot } from "react-dom/client";

// Simple test component
function TestApp() {
  return <div>Hello World - React is working!</div>;
}

// Mount the React app
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<TestApp />);
} else {
  console.error("Root element not found!");
}
