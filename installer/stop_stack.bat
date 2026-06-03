@echo off
setlocal

set "ROOT_DIR=%~dp0.."
set "EVOLUTION_DIR=%ROOT_DIR%\infra\evolution"
set "EVOLUTION_ENV=%EVOLUTION_DIR%\.env"

if exist "%EVOLUTION_ENV%" (
  docker compose --env-file "%EVOLUTION_ENV%" -f "%EVOLUTION_DIR%\compose.yaml" down
) else (
  docker compose -f "%EVOLUTION_DIR%\compose.yaml" down
)
