#!/bin/bash
# Bootstrap script — run once on a fresh Lightsail Ubuntu instance.
# All secrets come from environment variables; export them before running,
# or the script will prompt for the required ones.
set -e

prompt_if_empty() {
  local var="$1" prompt="$2"
  if [ -z "${!var}" ]; then
    read -rsp "$prompt: " val; echo
    export "$var"="$val"
  fi
}

echo "=== Checking required secrets ==="
prompt_if_empty POSTGRES_PASSWORD    "POSTGRES_PASSWORD"
prompt_if_empty NEXTAUTH_SECRET      "NEXTAUTH_SECRET (run: openssl rand -base64 32)"
prompt_if_empty NEXTAUTH_URL         "NEXTAUTH_URL (e.g. http://54.171.14.135:3000)"

echo "=== Installing Docker ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  apt-get install -y docker-compose-plugin git
fi

REPO_DIR=/opt/farm
BRANCH=claude/disease-reporter-identification-g1MTI

if [ -d "$REPO_DIR/.git" ]; then
  echo "=== Updating repo ==="
  git -C "$REPO_DIR" fetch origin
  git -C "$REPO_DIR" checkout "$BRANCH"
  git -C "$REPO_DIR" pull origin "$BRANCH"
else
  echo "=== Cloning repo ==="
  git clone https://github.com/melamanager/entoto-riverside-farm "$REPO_DIR"
  git -C "$REPO_DIR" checkout "$BRANCH"
fi

echo "=== Writing .env ==="
cat > "$REPO_DIR/.env" <<EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=${NEXTAUTH_URL}
EOF

echo "=== Starting app ==="
cd "$REPO_DIR"
docker compose up -d --build

echo ""
echo "=== Done! App starting at ${NEXTAUTH_URL} ==="
echo "    (first build takes 3-5 minutes — watch with: docker compose logs -f app)"
