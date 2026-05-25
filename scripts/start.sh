#!/bin/sh
set -e
node /app/node_modules/prisma/dist/bin.js migrate deploy
exec node server.js
