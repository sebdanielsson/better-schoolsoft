import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./hooks/useAuth.tsx";
import "./index.css";

/** Whether the `?mock=1` preview mode is compiled into this build.
 *
 *  `dev-mocks.ts` is ~1.5k lines that monkey-patch `fetch`, seed a fake
 *  authenticated session into localStorage, and persist that choice across
 *  reloads. It used to be imported unconditionally, so all of it shipped to
 *  production and any visitor following a `?mock=1` link got a fabricated
 *  session on the real origin.
 *
 *  Both operands are statically analysable, so a normal production build drops
 *  the dynamic import and the module with it. Set `VITE_ENABLE_MOCKS=1` at
 *  build time to produce a demo build that keeps it. */
const MOCKS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === "1";

async function bootstrap() {
  /* Awaited before the first render so a mocked `fetch` is in place before any
   * component can issue a request. */
  if (MOCKS_ENABLED) {
    const { shouldInstallMocks, installMocks } = await import("./dev-mocks.ts");
    if (shouldInstallMocks()) installMocks();
  }

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
