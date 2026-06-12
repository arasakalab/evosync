@echo off
REM Inicia o EvoSync web no Windows
cd /d "%~dp0"

if not exist node_modules (
  echo [evosync-web] instalando dependencias (npm install)...
  call npm install || exit /b 1
)

if not exist .env (
  copy .env.example .env >NUL
  echo [evosync-web] .env criado a partir de .env.example — preencha EVO_APIKEY.
)

if "%NODE_ENV%"=="production" if not exist .next (
  echo [evosync-web] gerando build de producao...
  call npm run build || exit /b 1
)

call npm run start
