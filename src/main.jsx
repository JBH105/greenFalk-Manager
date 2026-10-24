import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./App.css";
import "./colors.css";
import { BrowserRouter } from "react-router-dom";
import { SocketProvider } from "./socket/SocketProvider.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { registerSW } from "virtual:pwa-register";
import { ResponsiveProvider } from "./context/ResponsiveContext.jsx";
import { bootLanguage } from "./i18n";

// 👇 Register Service Worker safely
const updateSW = registerSW({
  immediate: false, // ✅ VERY IMPORTANT
  onRegistered(r) {
    // console.log("✅ Service Worker registered", r);
  },
  onOfflineReady() {
    // console.log("📦 App is ready to work offline");
  },
});

/**
 * Put the saved language on the document before React draws anything.
 *
 * The direction lives on the root element, and the browser reads it for
 * things no stylesheet reaches: which way the caret moves in an input, which
 * way a native select opens, how a double-click selects a word. Set after the
 * first paint instead, an Arabic till flashes left-to-right on every reload.
 */
bootLanguage();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ResponsiveProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </ResponsiveProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
