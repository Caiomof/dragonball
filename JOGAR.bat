@echo off
setlocal EnableExtensions
chcp 65001 >nul
title DragonBallRPG - Inicializador
cd /d "%~dp0"

echo ====================================
echo          DragonBallRPG
echo ====================================
echo.

if not exist "package.json" (
    echo [ERRO] package.json nao encontrado.
    echo Extraia o ZIP completo antes de executar JOGAR.bat.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 goto install_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto install_node
goto node_ready

:install_node
echo [INFO] Node.js nao encontrado. Tentando instalar a versao LTS pelo winget...
where winget >nul 2>&1
if errorlevel 1 (
    echo [ERRO] winget indisponivel. Instale Node.js LTS em https://nodejs.org/
    pause
    exit /b 1
)
winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements --silent
if errorlevel 1 (
    echo [ERRO] A instalacao automatica do Node.js falhou.
    pause
    exit /b 1
)
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Node.js instalado, mas nao disponivel nesta sessao.
    echo Feche esta janela e execute JOGAR.bat novamente.
    pause
    exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Reinicie este arquivo para atualizar o PATH do npm.
    pause
    exit /b 1
)

:node_ready
echo [OK] Node.js encontrado:
node --version

if not exist "node_modules\.package-lock.json" (
    echo [INFO] Instalando dependencias...
    if exist "package-lock.json" (
        call npm.cmd ci
    ) else (
        call npm.cmd install
    )
    if errorlevel 1 (
        echo [ERRO] Falha na instalacao de dependencias.
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencias presentes.
)

echo.
echo [INFO] Iniciando o jogo...
start "DragonBallRPG - Servidor" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready=$false; for($i=0;$i -lt 60;$i++){try{$response=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:5173/' -TimeoutSec 2; if($response.StatusCode -eq 200){$ready=$true;break}}catch{}; Start-Sleep -Seconds 1}; if($ready){Start-Process 'http://127.0.0.1:5173/'; exit 0}else{exit 1}"
if errorlevel 1 (
    echo [ERRO] O servidor nao respondeu. Consulte a janela DragonBallRPG - Servidor.
    pause
    exit /b 1
)

echo [OK] Jogo aberto no navegador.
echo Para parar o jogo, feche a janela DragonBallRPG - Servidor.
exit /b 0
