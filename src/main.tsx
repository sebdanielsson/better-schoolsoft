import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./hooks/useAuth.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/install.ts";
import { watchForUpdates } from "./lib/app-update.ts";

/* `dev-mocks/` monkey-patches `fetch` and seeds a fake session, so it must
 * never ship by accident: it used to be imported unconditionally, and any
 * visitor following a `?mock=1` link got a fabricated session on the real
 * origin. Both operands are static, so a normal production build drops the
 * dynamic import below and the module with it. Keep the expression inline:
 * imported from another module, the bundler no longer folds it. */
const MOCKS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === "1";

async function bootstrap() {
  /* Awaited before the first render so a mocked `fetch` is in place before any
   * component can issue a request. */
  if (MOCKS_ENABLED) {
    const { shouldInstallMocks, installMocks } = await import("./dev-mocks/index.ts");
    if (shouldInstallMocks()) installMocks();
  }

  registerServiceWorker();
  watchForUpdates();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
