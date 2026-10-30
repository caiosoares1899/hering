@echo off
rem Abre o mini painel na bandeja do Windows (icone perto do relogio). Pode dar duplo clique ou rodar no cmd.
rem Normal: abre escondido e devolve o prompt. Com -Visivel: roda AQUI, nesta janela, e mostra qualquer erro.
if /i "%~1"=="-Visivel" goto visivel
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0oceano-bandeja.ps1" %*
goto :eof
:visivel
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0oceano-bandeja.ps1" %*
echo.
echo O mini painel terminou (se foi um erro, ele esta escrito acima).
pause
