import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  PROXY_SECURITY_HEADERS,
  rewriteCookiePath,
  rewriteLocation,
} from "./api/_lib/proxy-rewrites.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react({ compiler: true }), tailwindcss()],
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
