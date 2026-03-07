#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  SportVault — Pre-flight diagnostic
#  Run from Sprint_4 root:  bash check.sh
# ─────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS="${GREEN}✅${NC}"; FAIL="${RED}❌${NC}"; WARN="${YELLOW}⚠️ ${NC}"

ok=true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SportVault Pre-flight Diagnostic"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Docker ───────────────────────────────────────────────
if docker info >/dev/null 2>&1; then
  echo -e "  ${PASS}  Docker is running"
else
  echo -e "  ${FAIL}  Docker is NOT running"
  echo "       → Open Docker Desktop and wait for it to fully start"
  ok=false
fi

# ── Containers ───────────────────────────────────────────
check_port() {
  local name="$1"; local port="$2"
  if nc -z -w2 localhost "$port" 2>/dev/null; then
    echo -e "  ${PASS}  $name (port $port)"
  else
    echo -e "  ${FAIL}  $name (port $port) NOT reachable"
    echo "       → Run: docker compose up -d"
    ok=false
  fi
}

check_port "PostgreSQL authn_authz"   5432
check_port "PostgreSQL account"       5433
check_port "PostgreSQL admin"         5434
check_port "PostgreSQL shopping_cart" 5435
check_port "PostgreSQL order"         5436
check_port "PostgreSQL inventory"     5437
check_port "PostgreSQL seller"        5438
check_port "Kafka broker"           9092
check_port "ZooKeeper"              2181

# ── .env files ───────────────────────────────────────────
echo ""
check_env() {
  local svc="$1"; local dir="$2"
  if [ -f "$dir/.env" ]; then
    echo -e "  ${PASS}  $svc .env found"
  else
    echo -e "  ${FAIL}  $svc .env MISSING"
    echo "       → Run: cp $dir/.env.example $dir/.env"
    ok=false
  fi
}
check_env "authn-authz-service"  "services/authn-authz-service"
check_env "account-service"       "services/account-service"
check_env "admin-service"         "services/admin-service"
check_env "shopping-cart-service" "services/shopping-cart-service"
check_env "order-service"         "services/order-service"
check_env "inventory-service"     "services/inventory-service"
check_env "seller-service"        "services/seller-service"

# ── Node version ─────────────────────────────────────────
echo ""
node_ver=$(node -e "process.stdout.write(process.version)" 2>/dev/null || echo "not found")
node_major=$(echo "$node_ver" | sed 's/v//' | cut -d. -f1)
if [ "$node_major" -ge 18 ] 2>/dev/null; then
  echo -e "  ${PASS}  Node.js $node_ver"
else
  echo -e "  ${WARN}  Node.js $node_ver (v18+ recommended)"
fi

# ── Summary ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ok" = true ]; then
  echo -e "  ${PASS}  All checks passed — services should start cleanly"
  echo ""
  echo "  Start order (8 separate terminals):"
  echo "    Terminal 1:  cd services/authn-authz-service  && npm run dev"
  echo "    Terminal 2:  cd services/account-service        && npm run dev"
  echo "    Terminal 3:  cd services/admin-service           && npm run dev"
  echo "    Terminal 4:  cd services/shopping-cart-service   && npm run dev"
  echo "    Terminal 5:  cd services/order-service           && npm run dev"
  echo "    Terminal 6:  cd services/inventory-service       && npm run dev"
  echo "    Terminal 7:  cd services/seller-service          && npm run dev"
  echo "    Terminal 8:  cd apps/web                         && npm run dev"
else
  echo -e "  ${FAIL}  One or more checks failed — fix issues above first"
  echo ""
  echo "  Quick fix:"
  echo "    docker compose up -d"
  echo "    # Wait 30 seconds, then run this script again"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
