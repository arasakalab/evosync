@echo off
setlocal
set "ROOT_DIR=%~dp0.."
set "EVOLUTION_DIR=%ROOT_DIR%\infra\evolution"
set "EVOLUTION_ENV=%EVOLUTION_DIR%\.env"
set "WEB_DIR=%ROOT_DIR%\evosync-web"
if "%PORT%"=="" set "PORT=3000"

cd /d "%ROOT_DIR%"

if exist "%EVOLUTION_ENV%" (
  docker compose --env-file "%EVOLUTION_ENV%" -f "%EVOLUTION_DIR%\compose.yaml" up -d || (
    echo [EvoSync] Nao foi possivel subir a stack Docker.
    exit /b 1
  )
) else (
  echo [EvoSync] infra\evolution\.env nao encontrado. Rode installer\install_web_windows.ps1 primeiro.
  exit /b 1
)

if not exist "%WEB_DIR%" (
  echo [EvoSync] Diretorio evosync-web nao encontrado.
  exit /b 1
)

if not exist "%WEB_DIR%\node_modules" (
  echo [EvoSync] Dependencias nao instaladas. Rode installer\install_web_windows.ps1 primeiro.
  exit /b 1
)

if not exist "%WEB_DIR%\.env" if exist "%ROOT_DIR%\.env" copy "%ROOT_DIR%\.env" "%WEB_DIR%\.env" >NUL

if not exist "%WEB_DIR%\.next" (
  echo [EvoSync] Build nao encontrado, gerando...
  pushd "%WEB_DIR%"
  call npm run build || (popd & exit /b 1)
  popd
)

pushd "%WEB_DIR%"
set "NODE_ENV=production"
set "PORT=%PORT%"
call npm run start
popd
