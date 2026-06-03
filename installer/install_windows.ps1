$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$AppEnv = Join-Path $RootDir ".env"
$EvolutionDir = Join-Path $RootDir "infra\evolution"
$EvolutionEnv = Join-Path $EvolutionDir ".env"

function Write-Step($Message) {
    Write-Host ""
    Write-Host "[DisparoFacil] $Message"
}

function Fail($Message) {
    Write-Host ""
    Write-Error "[DisparoFacil] ERRO: $Message"
    exit 1
}

function Test-Command($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function New-Secret {
    return ([Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")).Substring(0, 48)
}

Set-Location $RootDir

Write-Step "Verificando Docker Compose"
if (-not (Test-Command "docker")) {
    Fail "Docker nao encontrado. Instale o Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/"
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Fail "Docker Compose nao encontrado. Abra/atualize o Docker Desktop e tente novamente."
}

Write-Step "Verificando Python"
if (-not (Test-Command "python")) {
    Fail "Python nao encontrado. Instale Python 3.10+ e marque a opcao Add Python to PATH."
}

if (-not (Test-Path (Join-Path $RootDir ".venv"))) {
    Write-Step "Criando ambiente virtual .venv"
    python -m venv (Join-Path $RootDir ".venv")
} else {
    Write-Step "Ambiente virtual .venv ja existe"
}

Write-Step "Instalando dependencias Python"
& (Join-Path $RootDir ".venv\Scripts\python.exe") -m pip install --upgrade pip
& (Join-Path $RootDir ".venv\Scripts\pip.exe") install -r (Join-Path $RootDir "requirements.txt")

if (-not (Test-Path $AppEnv)) {
    Write-Step "Criando .env do app"
    @"
EVO_URL=http://localhost:8080
EVO_APIKEY=coloque_a_mesma_chave_de_AUTHENTICATION_API_KEY
EVO_INSTANCE=disparofacil
"@ | Set-Content -Path $AppEnv -Encoding UTF8
} else {
    Write-Step ".env do app ja existe; preservando"
}

if (-not (Test-Path $EvolutionEnv)) {
    Write-Step "Criando configuracao da Evolution API"
    $ApiKey = New-Secret
    $PostgresPassword = New-Secret
    @"
EVOLUTION_PORT=8080
SERVER_URL=http://localhost:8080

AUTHENTICATION_API_KEY=$ApiKey

POSTGRES_DATABASE=evolution
POSTGRES_USERNAME=evolution
POSTGRES_PASSWORD=$PostgresPassword
"@ | Set-Content -Path $EvolutionEnv -Encoding UTF8
    Write-Step "Chave da Evolution gerada. Copie AUTHENTICATION_API_KEY de infra\evolution\.env para EVO_APIKEY no .env do app."
} else {
    Write-Step "infra\evolution\.env ja existe; preservando"
}

if (Test-Command "opencode") {
    Write-Step "OpenCode encontrado"
} else {
    Write-Step "OpenCode nao encontrado. Para usar IA, instale com: npm install -g opencode-ai"
}

Write-Step "Subindo Evolution API, PostgreSQL e Redis"
docker compose --env-file $EvolutionEnv -f (Join-Path $EvolutionDir "compose.yaml") up -d
if ($LASTEXITCODE -ne 0) {
    Fail "Nao foi possivel subir a stack Docker. Verifique se o Docker Desktop esta aberto e se a porta 8080 esta livre. Para trocar a porta, edite EVOLUTION_PORT em infra\evolution\.env e EVO_URL no .env do app."
}

Write-Step "Instalacao concluida"
Write-Host ""
Write-Host "Evolution API: http://localhost:8080"
Write-Host "App: installer\start_windows.bat"
Write-Host ""

& (Join-Path $RootDir ".venv\Scripts\python.exe") (Join-Path $RootDir "main.py")
