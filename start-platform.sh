#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Starting Munzer Haddara Math Academy..."
npm install
npm run dev
