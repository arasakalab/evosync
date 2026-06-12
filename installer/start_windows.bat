@echo off
setlocal

set "ROOT_DIR=%~dp0.."
set "EVOLUTION_DIR=%ROOT_DIR%\infra\evolution"
set "EVOLUTION_ENV=%EVOLUTION_DIR%\.env"

cd /d "%ROOT_DIR%"

if not exist "%EVOLUTION_ENV%" (
  echo [EvoSync] infra\evolution\.env nao encontrado. Rode installer\install_windows.ps1 primeiro.
  exit /b 1
)

docker compose --env-file "%EVOLUTION_ENV%" -f "%EVOLUTION_DIR%\compose.yaml" up -d
if errorlevel 1 (
  echo [EvoSync] Nao foi possivel subir a stack Docker. Verifique se o Docker Desktop esta aberto e se a porta 8080 esta livre.
  exit /b 1
)

if exist "%ROOT_DIR%\.venv\Scripts\python.exe" (
  "%ROOT_DIR%\.venv\Scripts\python.exe" "%ROOT_DIR%\main.py"
) else (
  python "%ROOT_DIR%\main.py"
)
