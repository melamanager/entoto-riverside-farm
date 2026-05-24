#!/bin/bash
set -e

echo "=== Installing Docker ==="
curl -fsSL https://get.docker.com | sh
systemctl enable docker

echo "=== Installing dependencies ==="
apt-get install -y docker-compose-plugin git

echo "=== Cloning repo ==="
git clone https://github.com/melamanager/entoto-riverside-farm /opt/farm

echo "=== Writing .env ==="
cat > /opt/farm/.env << 'ENVEOF'
POSTGRES_PASSWORD=F4rm$ecure2026!
DATABASE_URL=postgresql://entoto:F4rm$ecure2026!@postgres:5432/entoto_farm
NEXTAUTH_SECRET=jtaUqPUsQKaWQLv5Jmq0InoM0DQN6KAckePsYJ7hEHA=
NEXTAUTH_URL=http://52.209.207.200:3000
SMS_ETHIOPIA_TOKEN=ZE6V155XK40ZZHHBM3NWD73MM5C8RVQT:759
TELEGRAM_BOT_TOKEN=8122676514:AAEDouJqDlCfKf0xA3ULAex3KdWtrZTkSu4
TOMORROW_IO_API_KEY=aa1bCmz9jxDoAT4lazNKw5PRNZwsmvLH
ENVEOF

echo "=== Starting app ==="
cd /opt/farm
git checkout claude/disease-reporter-identification-g1MTI
docker compose up -d --build

echo "=== Done! App starting at http://52.209.207.200:3000 ==="
