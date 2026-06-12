$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$AppEnv = Join-Path $RootDir ".env"
$EvolutionDir = Join-Path $RootDir "infra\evolution"
$EvolutionEnv = Join-Path $EvolutionDir ".env"
$WebDir = Join-Path $RootDir "evosync-web"

function Info($msg) { Write-Host "`n[EvoSync] $msg" }
function Fail($msg) { Write-Host "`n[EvoSync] ERRO: $msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail "Docker nao encontrado. Instale o Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/"
}
try { docker compose version | Out-Null } catch { Fail "Docker Compose nao encontrado." }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js nao encontrado. Instale Node 18+ antes: https://nodejs.org/"
}
$nodeMajor = [int](node -p 'process.versions.node.split(".")[0]')
if ($nodeMajor -lt 18) { Fail "Node 18+ necessario. Detectado: $(node --version)" }

if (-not (Test-Path $WebDir)) { Fail "Diretorio evosync-web nao encontrado." }

if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
  Info "Instalando dependencias do evosync-web (npm install)..."
  Push-Location $WebDir
  npm install
  Pop-Location
} else {
  Info "Dependencias do evosync-web ja instaladas"
}

if (-not (Test-Path $AppEnv)) {
  Info "Criando .env do app"
  @"
EVO_URL=http://localhost:8080
EVO_APIKEY=coloque_a_mesma_chave_de_AUTHENTICATION_API_KEY
EVO_INSTANCE=disparofacil
"@ | Set-Content -Path $AppEnv -Encoding utf8
  try { icacls $AppEnv /inheritance:r /grant:r "$env:USERNAME:(R,W)" | Out-Null } catch {}
} else {
  Info ".env do app ja existe; preservando"
}

if (-not (Test-Path (Join-Path $WebDir ".env"))) {
  if (Test-Path $AppEnv) { Copy-Item $AppEnv (Join-Path $WebDir ".env") }
  elseif (Test-Path (Join-Path $WebDir ".env.example")) { Copy-Item (Join-Path $WebDir ".env.example") (Join-Path $WebDir ".env") }
}

if (-not (Test-Path $EvolutionEnv)) {
  Info "Criando configuracao da Evolution API"
  $apiKey = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  $pgPass = -join ((1..36) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  @"
EVOLUTION_PORT=8080
SERVER_URL=http://localhost:8080

AUTHENTICATION_API_KEY=$apiKey

POSTGRES_DATABASE=evolution
POSTGRES_USERNAME=evolution
POSTGRES_PASSWORD=$pgPass
"@ | Set-Content -Path $EvolutionEnv -Encoding utf8
  try { icacls $EvolutionEnv /inheritance:r /grant:r "$env:USERNAME:(R,W)" | Out-Null } catch {}
  Info "Chave da Evolution gerada. Copie AUTHENTICATION_API_KEY para EVO_APIKEY no .env."
} else {
  Info "infra\evolution\.env ja existe; preservando"
}

if (Get-Command opencode -ErrorAction SilentlyContinue) {
  Info "OpenCode encontrado"
} else {
  Info "OpenCode nao encontrado (opcional). Para usar IA, instale: irm https://opencode.ai/install.ps1 | iex"
}

Info "Subindo Evolution API, PostgreSQL e Redis"
$env:EVOLUTION_ENV = $EvolutionEnv
try { docker compose --env-file $EvolutionEnv -f (Join-Path $EvolutionDir "compose.yaml") up -d } catch {
  Fail "Nao foi possivel subir a stack Docker. Verifique se o Docker esta aberto e a porta 8080 livre."
}

Info "Build de producao (Next.js)"
Push-Location $WebDir
npm run build
Pop-Location

Info "Instalacao concluida"
Write-Host "`nEvolution API: http://localhost:8080"
Write-Host "EvoSync web:   http://localhost:3000`n"
Write-Host "Para iniciar: installer\start_web_windows.bat`n"
