@echo off
chcp 65001 >nul
title Plantao de Ferias do Caio - Daemon GitHub (16/10 a 03/11)
cd /d "%~dp0"
echo ============================================================================
echo   PLANTAO DE FERIAS DO CAIO (16/10 a 03/11) - PONTE ZERO-TERMINAL
echo   Mantenha esta janela aberta junto com o Antigravity!
echo   Ela cria as branches, abre as PRs (-dev e prod) e comenta nas Issues
echo   sem precisar de clique em "Require Review" no Antigravity.
echo ============================================================================
echo.
:loop
node scripts/ferias-daemon.js
echo.
echo [Aviso] O processo encerrou. Reiniciando em 10 segundos...
timeout /t 10
goto loop
