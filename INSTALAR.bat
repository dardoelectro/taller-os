@echo off
cd /d "%~dp0"
echo.
echo ============================================
echo    TallerOS - Instalador Automatico
echo    autoelectrolab.com
echo ============================================
echo.

REM ── PASO 1: Verificar Node.js ─────────────────────
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Node.js no esta instalado.
    echo.
    echo Abri este link en el navegador y descarga la version LTS:
    echo    https://nodejs.org
    echo.
    echo Despues de instalarlo, volvé a ejecutar este archivo.
    pause
    exit /b 1
)
echo [OK] Node.js encontrado.

REM ── PASO 2: Verificar o instalar MongoDB ──────────
echo.
echo [2/5] Verificando MongoDB...

REM Buscar mongod en las rutas tipicas de instalacion
SET MONGO_PATH=
IF EXIST "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" SET MONGO_PATH=C:\Program Files\MongoDB\Server\8.0\bin
IF EXIST "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" SET MONGO_PATH=C:\Program Files\MongoDB\Server\7.0\bin
IF EXIST "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" SET MONGO_PATH=C:\Program Files\MongoDB\Server\6.0\bin

mongod --version >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] MongoDB encontrado en PATH.
    GOTO MONGO_OK
)

IF NOT "%MONGO_PATH%"=="" (
    echo [OK] MongoDB encontrado en: %MONGO_PATH%
    SET PATH=%PATH%;%MONGO_PATH%
    GOTO MONGO_OK
)

REM MongoDB no encontrado - descargarlo automaticamente
echo [INFO] MongoDB no encontrado. Descargando instalador...
echo       Esto puede tardar unos minutos segun tu conexion.
echo.

SET MONGO_INSTALLER=%TEMP%\mongodb-installer.msi
curl -L -o "%MONGO_INSTALLER%" "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14-signed.msi"

IF NOT EXIST "%MONGO_INSTALLER%" (
    echo.
    echo [ERROR] No se pudo descargar MongoDB automaticamente.
    echo Descargalo manualmente desde:
    echo    https://www.mongodb.com/try/download/community
    echo Elegir: Windows - MSI - Marcar "Install as a Service"
    echo Luego volvé a ejecutar este instalador.
    pause
    exit /b 1
)

echo [INFO] Instalando MongoDB (esto abre el instalador)...
echo        En el instalador: Next - Next - marcá "Install MongoD as a Service" - Install
echo.
msiexec /i "%MONGO_INSTALLER%" /qb ADDLOCAL="ServerService" SHOULD_INSTALL_COMPASS="0"
timeout /t 5 /nobreak >nul
del "%MONGO_INSTALLER%" >nul 2>&1

REM Actualizar PATH con la nueva instalacion
IF EXIST "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" (
    SET MONGO_PATH=C:\Program Files\MongoDB\Server\7.0\bin
    SET PATH=%PATH%;%MONGO_PATH%
    echo [OK] MongoDB instalado correctamente.
) ELSE (
    echo [AVISO] MongoDB instalado como servicio de Windows.
    echo         El servicio se inicia automaticamente con Windows.
)

:MONGO_OK

REM ── PASO 3: Instalar dependencias Node ────────────
echo.
echo [3/5] Instalando dependencias...
call npm install express mongoose qrcode cors dotenv puppeteer-core
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas.

REM ── PASO 4: Crear carpetas necesarias ─────────────
echo.
echo [4/5] Creando estructura de carpetas...
IF NOT EXIST "data\db"     mkdir data\db
IF NOT EXIST "public\img"  mkdir public\img
echo [OK] Carpetas listas.
echo.
echo      IMPORTANTE: Si tenes un logo para el taller,
echo      copia el archivo (logo.png) en esta carpeta:
echo      %~dp0public\img\
echo      El sistema lo mostrara automaticamente.

REM ── PASO 5: Crear acceso directo en el escritorio ─
echo.
echo [5/5] Creando acceso directo en el escritorio...
SET SHORTCUT_PATH=%USERPROFILE%\Desktop\TallerOS.lnk
SET TARGET=%~dp0INICIAR_TALLEROS.bat
SET ICON_PATH=%~dp0public\img\logo.ico

powershell -Command ^
  "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT_PATH%');" ^
  "$s.TargetPath='%TARGET%';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.Description='TallerOS - Sistema de Recepcion de Vehiculos';" ^
  "$s.Save()"

IF EXIST "%SHORTCUT_PATH%" (
    echo [OK] Acceso directo creado en el escritorio.
) ELSE (
    echo [AVISO] No se pudo crear el acceso directo automaticamente.
    echo         Podes crear uno manualmente desde INICIAR_TALLEROS.bat
)

echo.
echo ============================================
echo    Instalacion completada correctamente
echo.
echo    Para usar TallerOS:
echo    - Doble clic en el icono del escritorio
echo      "TallerOS"
echo    - O ejecuta: INICIAR_TALLEROS.bat
echo.
echo    Si tenes un logo del taller, copialo como:
echo    %~dp0public\img\logo.png
echo ============================================
echo.
pause
