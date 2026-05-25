#!/bin/sh
set -e
node /app/node_modules/prisma/build/index.js migrate deploy
exec node server.js
