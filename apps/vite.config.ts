import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy auth calls to AuthnAuthzService (:3001)
      "/api/auth": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, "/auth"),
      },
      // Proxy account calls to AccountService (:3002)
      "/api/accounts": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/accounts/, "/accounts"),
      },
      // Proxy admin calls to AdminService (:3003)
      "/api/admin": {
        target: "http://localhost:3003",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/admin/, "/admin"),
      },
      // Proxy inventory calls to InventoryService (:3007)
      "/api/inventory": {
        target: "http://localhost:3007",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/inventory/, "/inventory"),
      },
      // Proxy cart calls to ShoppingCartService (:3004)
      "/api/cart": {
        target: "http://localhost:3004",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cart/, "/cart"),
      },
      // Proxy order calls to OrderService (:3005)
      "/api/orders": {
        target: "http://localhost:3005",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/orders/, "/orders"),
      },
    },
  },
});
