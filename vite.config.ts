import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
    },
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  server: {
    proxy: {
      "/schoolsoft": {
        target: "https://sms.schoolsoft.se",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/schoolsoft/, ""),
        /* Cookies set by SchoolSoft use Path=/<school>, which won't match
         * our /schoolsoft/<school>/... proxy path. Prepend /schoolsoft to
         * every Set-Cookie path so the browser sends the cookies back to us. */
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const cookies = proxyRes.headers["set-cookie"];
            if (Array.isArray(cookies)) {
              proxyRes.headers["set-cookie"] = cookies.map((c) =>
                c.replace(/(\bPath=)(\/[^;]*)/i, "$1/schoolsoft$2"),
              );
            }
          });
        },
      },
    },
  },
});
