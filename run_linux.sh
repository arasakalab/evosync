#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

exec bash installer/start_linux.sh
