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
      // Proxy admin calls to AdminService
      "/api/admin": {
        target: "http://localhost:3003",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/admin/, "/admin"),
      },
      // Proxy inventory calls to InventoryService
      "/api/inventory": {
      "/api/cart": {
        target: "http://localhost:3005",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cart/, "/cart"),
      },
      "/api/orders": {
        target: "http://localhost:3006",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/orders/, "/orders"),
      },
        target: "http://localhost:3007",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/inventory/, "/inventory"),
      },
    },
  },
});