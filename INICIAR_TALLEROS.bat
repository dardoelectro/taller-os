@echo off
cd /d "%~dp0"
echo.
echo ============================================
echo    TallerOS - Iniciando Sistema
echo    autoelectrolab.com
echo ============================================
echo.

REM ── Auto-instalar dependencias si no existen ──
IF NOT EXIST "node_modules" (
    echo [INFO] Primera ejecucion - instalando dependencias...
    call npm install express mongoose qrcode cors dotenv puppeteer-core
    echo [OK] Dependencias instaladas.
    echo.
)

REM ── Verificar si MongoDB ya corre como servicio ───
sc query MongoDB >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] MongoDB corre como servicio de Windows.
    sc start MongoDB >nul 2>&1
    timeout /t 2 /nobreak >nul
    GOTO NODE_START
)

REM ── Si no es servicio, intentar iniciar manualmente ─
echo Iniciando MongoDB...
SET MONGO_PATH=
IF EXIST "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" SET MONGO_PATH=C:\Program Files\MongoDB\Server\8.0\bin
IF EXIST "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" SET MONGO_PATH=C:\Program Files\MongoDB\Server\7.0\bin
IF EXIST "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" SET MONGO_PATH=C:\Program Files\MongoDB\Server\6.0\bin

IF NOT "%MONGO_PATH%"=="" (
    start "MongoDB" /min "%MONGO_PATH%\mongod.exe" --dbpath "%~dp0data\db" --port 27017
    timeout /t 3 /nobreak >nul
    echo [OK] MongoDB iniciado.
) ELSE (
    mongod --version >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        start "MongoDB" /min mongod --dbpath "%~dp0data\db" --port 27017
        timeout /t 3 /nobreak >nul
        echo [OK] MongoDB iniciado.
    ) ELSE (
        echo [AVISO] MongoDB no encontrado. Si ya esta instalado como servicio, continua.
        timeout /t 2 /nobreak >nul
    )
)

:NODE_START
echo Iniciando servidor TallerOS...
timeout /t 1 /nobreak >nul
echo Abriendo navegador...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ============================================
echo    TallerOS corriendo en:
echo    http://localhost:3000
echo.
echo    Para cerrar: presiona Ctrl+C aqui
echo ============================================
echo.

node server/index.js
pause
