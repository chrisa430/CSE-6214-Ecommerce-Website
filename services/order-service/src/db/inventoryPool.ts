import { Pool } from "pg";

let inventoryPool: Pool | null = null;

export function getInventoryPool(): Pool {
  if (!inventoryPool) {
    inventoryPool = new Pool({
      host: "localhost",
      port: 5437, // inventory-service DB port
      database: "inventory",
      user: "inventory_user",
      password: "inventory_pass",
    });
  }

  return inventoryPool;
}