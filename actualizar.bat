@echo off
color 0A
echo ===================================================
echo     AUTO-DEPLOY Y BACKUP - VALANNIA LOGISTICS
echo ===================================================
echo.

:: 1. Pedir el mensaje para el guardado
set /p mensaje="Escribe que has modificado (ej. Nuevo color de fondo): "

:: Si no escribes nada y le das a Enter, pone un texto por defecto
if "%mensaje%"=="" set mensaje="Actualizacion rapida"

echo.
echo [1/4] Compilando y actualizando la pagina web en GitHub Pages...
:: Usamos 'call' para que el script no se cierre al terminar npm
call npm run deploy

echo.
echo [2/4] Preparando los archivos fuente...
git add .

echo.
echo [3/4] Creando el punto de guardado (Commit)...
git commit -m "%mensaje%"

echo.
echo [4/4] Subiendo el codigo fuente a GitHub...
git push -u origin master

echo.
echo ===================================================
echo   ¡EXITO! Web actualizada y codigo guardado a salvo.
echo ===================================================
pause