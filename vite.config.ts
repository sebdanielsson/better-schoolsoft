import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  LOGOUT_PATH,
  PROXY_SECURITY_HEADERS,
  isAllowedUpstreamRequest,
  logoutCookies,
  rewriteCookiePath,
  rewriteLocation,
} from "./api/_lib/proxy-rewrites.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The production proxy's path rules, applied in dev too, so an endpoint
 *  outside the allowlist fails here instead of only after deploy. Runs
 *  before Vite's own proxy (configureServer middlewares are installed first). */
function schoolsoftProxyGuard(): Plugin {
  return {
    name: "schoolsoft-proxy-guard",
    configureServer(server) {
      server.middlewares.use("/schoolsoft", (req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://dev").pathname;
        const logout = LOGOUT_PATH.exec(pathname);
        if (logout && req.method === "POST") {
          res.statusCode = 204;
          res.setHeader("set-cookie", logoutCookies(req.headers.cookie ?? null, logout[1]!));
          res.end();
          return;
        }
        if (
          !isAllowedUpstreamRequest(req.method ?? "GET", `https://sms.schoolsoft.se${pathname}`)
        ) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        next();
      });
    },
  };
}

/** Stamps each build with an id, in a `<meta name="app-version">` tag and in
 *  `/version.json`. A running app compares the two to notice a newer deploy
 *  (`src/lib/app-update.ts`). Build only: in dev, hot reload covers it. */
function appVersion(): Plugin {
  const version = Date.now().toString(36);
  return {
    name: "app-version",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { name: "app-version", content: version }, injectTo: "head" },
    ],
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react({ compiler: true }), tailwindcss(), schoolsoftProxyGuard(), appVersion()],
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
    },
  },
  server: {
    proxy: {
      "/schoolsoft": {
        target: "https://sms.schoolsoft.se",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/schoolsoft/, ""),
        /* Same header handling as the Vercel proxy function: re-scope cookies
         * under /schoolsoft, keep upstream redirects on our origin, and
         * sandbox the responses. */
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const cookies = proxyRes.headers["set-cookie"];
            if (Array.isArray(cookies)) {
              proxyRes.headers["set-cookie"] = cookies.map(rewriteCookiePath);
            }
            const location = proxyRes.headers.location;
            if (location) proxyRes.headers.location = rewriteLocation(location);
            for (const [k, v] of Object.entries(PROXY_SECURITY_HEADERS)) {
              proxyRes.headers[k.toLowerCase()] = v;
            }
          });
        },
      },
    },
  },
});
