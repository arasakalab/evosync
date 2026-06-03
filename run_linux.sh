#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ -d ".venv" ]; then
  . ".venv/bin/activate"
fi

python3 main.py
