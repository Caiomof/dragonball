@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if not exist "public\models\wildlife" mkdir "public\models\wildlife"
echo Instalando lobo 3D real e animado, de Ariescar/anyCreature (MIT)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest 'https://raw.githubusercontent.com/Ariescar/anyCreature/main/example/wolf.glb' -OutFile 'public\models\wildlife\wolf.glb' -UseBasicParsing -ErrorAction Stop; if((Get-Item 'public\models\wildlife\wolf.glb').Length -lt 20000){throw 'Arquivo incompleto'}; Write-Host '[OK] wolf.glb instalado' } catch { Write-Host '[ERRO]' $_.Exception.Message; exit 1 }"
if errorlevel 1 (pause & exit /b 1)
echo Abra o jogo novamente com JOGAR.bat para ver o lobo.
pause
