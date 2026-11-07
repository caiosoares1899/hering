#!/usr/bin/env bash
# delegar.sh — o maestro (Claude) entrega um contrato (§7.3 de docs/COORDENACAO_AGENTES.md)
# ao Codex num worktree próprio, em segundo plano, sem cerimônia.
#
#   scripts/delegar.sh <assunto> <arquivo-do-contrato.md>
#
# Cria ~/hering-codex-<assunto> na branch codex/<assunto> (a partir de origin/main), roda
# `codex exec` com sandbox workspace-write (+ o .git do clone principal como gravável, para o
# Codex conseguir commitar no worktree — testado em 07/11/2026) e grava contrato, log e resposta
# em ~/hering-logs/delegacoes/. Nunca usa sandbox sem restrição; push, PR, merge e deploy
# continuam com o maestro/Caio. Vários contratos = várias chamadas, todas em paralelo.
set -euo pipefail
[ $# -eq 2 ] || { echo "uso: $0 <assunto> <contrato.md>"; exit 2; }
ASSUNTO="$1"; CONTRATO="$2"
[[ "$ASSUNTO" =~ ^[a-z0-9-]+$ ]] || { echo "assunto: só a-z, 0-9 e hífen"; exit 2; }
[ -s "$CONTRATO" ] || { echo "contrato vazio: $CONTRATO"; exit 2; }

REPO="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
WT="$HOME/hering-codex-$ASSUNTO"
LOGS="$HOME/hering-logs/delegacoes"; mkdir -p "$LOGS"
BASE="$LOGS/$(date +%F)-codex-$ASSUNTO"
CODEX="$(ls -d "$HOME"/.vscode/extensions/openai.chatgpt-*/bin/macos-aarch64/codex 2>/dev/null | tail -1)"
[ -x "$CODEX" ] || { echo "codex não encontrado na extensão do VS Code"; exit 1; }

git -C "$REPO" fetch -q origin main
[ -d "$WT" ] || git -C "$REPO" worktree add -q "$WT" -b "codex/$ASSUNTO" origin/main
cp "$CONTRATO" "$BASE.md"

nohup "$CODEX" exec -s workspace-write -C "$WT" --ephemeral \
  -c "sandbox_workspace_write.writable_roots=[\"$REPO/.git\"]" \
  -o "$BASE.resposta.txt" "$(cat "$CONTRATO")" >"$BASE.log" 2>&1 &

echo "Codex rodando (pid $!) em $WT"
echo "resposta: $BASE.resposta.txt · log: $BASE.log"
echo "depois: git -C $WT log --oneline origin/main..HEAD && revisar o diff antes do push"
