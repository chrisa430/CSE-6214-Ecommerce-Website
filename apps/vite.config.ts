import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy auth calls to AuthnAuthzService
      "/api/auth": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, "/auth"),
      },
      // Proxy account calls to AccountService
      "/api/accounts": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/accounts/, "/accounts"),
      },
      "/api/inventory": {
        target: "http://localhost:3004",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/inventory/, "/inventory"),
      },
    },
  },
});
