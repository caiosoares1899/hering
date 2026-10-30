@echo off
rem Abre o mini painel na bandeja do Windows (icone perto do relogio). Pode dar duplo clique ou rodar no cmd.
rem -NoProfile evita o perfil do PowerShell (onde costuma estar o bug); a janela some sozinha. Para VER erros: iniciar-oceano.cmd -Visivel
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0oceano-bandeja.ps1" %*
