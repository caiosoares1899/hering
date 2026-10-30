<#
.SYNOPSIS
  Mini painel do Oceano na bandeja do Windows (perto do relogio): uma bolinha verde/amarela/vermelha com o resumo.

.DESCRIPTION
  Le o mesmo JSON da pagina minipainel.html (funcao oceanoResumo) a cada minuto e mostra:
   - o icone com a cor do estado geral e o numero de cards atrasados;
   - ao passar o mouse: um resumo curto; ao clicar: VTEX, GitHub, Firebase, backup, alarmes, plantao e os seus cards;
   - um aviso (balao) quando o estado PIORA.
  A chave vem do arquivo chave-oceano.txt da sua pasta de usuario (a mesma do secret OCEANO_RESUMO_KEY). Nada e instalado.
  Passo a passo: windows\README.md

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File windows\oceano-bandeja.ps1
#>
param(
  [string]$ArquivoChave = (Join-Path $env:USERPROFILE 'chave-oceano.txt'),
  [string]$Endereco = 'https://us-central1-hering-onboarding.cloudfunctions.net/oceanoResumo',
  [string]$PaginaWeb = 'https://caiosoares1899.github.io/hering/minipainel.html',
  [int]$IntervaloSegundos = 60,
  [switch]$Visivel   # mantem a janela do PowerShell aberta (para ver erros)
)

$ErrorActionPreference = 'Stop'

# Todo erro vai para um arquivo de log (%TEMP%\oceano-bandeja.log) E para a tela (no modo -Visivel): rodando escondido, e a unica pista do que houve.
$script:arquivoLog = Join-Path $env:TEMP 'oceano-bandeja.log'
function Registrar([string]$texto) {
  try { Add-Content -LiteralPath $script:arquivoLog -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $texto) } catch {}
}
trap {
  Registrar ('ERRO: ' + $_.Exception.Message + ' | ' + ($_.InvocationInfo.PositionMessage -replace '\s+', ' '))
  if ($Visivel) { Write-Host ('ERRO: ' + $_.Exception.Message); Write-Host ($_ | Out-String) }
  break
}
Registrar 'iniciando'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# (Nada de Add-Type com C#: em alguns Windows corporativos a compilacao e bloqueada. A janela escondida vem do iniciar-oceano.cmd.)

# Uma instancia so: abrir de novo nao duplica o icone.
$script:mutex = New-Object System.Threading.Mutex($false, 'Local\OceanoBandejaMiniPainel')
if (-not $script:mutex.WaitOne(0)) {
  Registrar 'ja estava rodando: saindo'
  if ($Visivel) { Write-Host 'O mini painel ja esta rodando (procure o icone perto do relogio ou na setinha ^).' }
  [System.Windows.Forms.MessageBox]::Show('O mini painel ja esta na bandeja (procure o icone perto do relogio).', 'Oceano') | Out-Null
  exit
}

Registrar 'abrindo o icone'
if ($Visivel) { Write-Host 'Mini painel iniciado. Procure o icone perto do relogio (ou na setinha ^ da bandeja). Feche esta janela para sair.' }

# ---------------------------------------------------------------------------------------------------------------------------------------------
# Leitura do JSON. SEMPRE por Campo <obj> 'caminho.do.campo': o teste functions/oceano/__tests__/contrato_windows.test.js confere
# que cada caminho existe no JSON real da funcao.
function Campo($obj, [string]$caminho) {
  $atual = $obj
  foreach ($parte in $caminho.Split('.')) {
    if ($null -eq $atual) { return $null }
    $atual = $atual.$parte
  }
  return $atual
}
function Numero($v) { if ($null -eq $v) { return 0 } else { return [int]$v } }

function Rotulo($estado) {
  switch ($estado) { 'ok' { 'OK' } 'atencao' { 'ATENCAO' } 'fora' { 'FORA DO AR' } 'off' { 'desligado' } default { 'sem leitura' } }
}
function Gravidade($estado) { switch ($estado) { 'fora' { 2 } 'atencao' { 1 } 'ok' { 0 } default { 0 } } }

function HoraDe($valor) {
  try {
    if ($valor -is [datetime]) { return $valor.ToLocalTime().ToString('HH:mm') }
    return ([datetimeoffset]::Parse([string]$valor)).LocalDateTime.ToString('HH:mm')
  } catch { return '--:--' }
}

function QuandoDoCard($c) {
  if (Campo $c 'atrasado') { $d = Numero (Campo $c 'diasAtraso'); if ($d -lt 1) { $d = 1 }; return ('atrasado ' + $d + $(if ($d -eq 1) { ' dia' } else { ' dias' })) }
  if (Campo $c 'bloqueado') { return 'bloqueado' }
  if (Campo $c 'venceHoje') { return 'vence hoje' }
  $p = [string](Campo $c 'prazo')
  if ($p -match '^\d{4}-(\d{2})-(\d{2})$') { return ('vence ' + $Matches[2] + '/' + $Matches[1]) }
  return 'sem prazo'
}

# ---------------------------------------------------------------------------------------------------------------------------------------------
function LerChave {
  if (-not (Test-Path -LiteralPath $ArquivoChave)) { return $null }
  $t = (Get-Content -LiteralPath $ArquivoChave -Raw)
  if ($null -eq $t) { return $null }
  $t = $t.Trim()
  if ($t.Length -eq 0) { return $null } else { return $t }
}

function Buscar {
  $chave = LerChave
  if (-not $chave) { return @{ ok = $false; erro = "Sem chave: crie $ArquivoChave com a chave do mini painel." } }
  $url = $Endereco + $(if ($Endereco.Contains('?')) { '&' } else { '?' }) + 'k=' + [uri]::EscapeDataString($chave)
  try {
    $r = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 15 -Headers @{ 'Cache-Control' = 'no-store' }
    return @{ ok = $true; resumo = $r }
  } catch {
    $codigo = 0
    try { $codigo = [int]$_.Exception.Response.StatusCode } catch {}
    if ($codigo -eq 403) { return @{ ok = $false; erro = 'A funcao recusou a chave (confira OCEANO_RESUMO_KEY).' } }
    if ($codigo -eq 429) { return @{ ok = $false; erro = 'Muitas consultas nesta hora; tente de novo em alguns minutos.' } }
    if ($codigo -ge 400) { return @{ ok = $false; erro = "A funcao respondeu com erro (HTTP $codigo)." } }
    return @{ ok = $false; erro = 'Sem conexao com a funcao.' }
  }
}

# ---------------------------------------------------------------------------------------------------------------------------------------------
# Icone: bolinha colorida (+ numero de atrasados). Cada combinacao e criada uma vez e reaproveitada.
$script:cores = @{
  ok = [System.Drawing.Color]::FromArgb(46, 204, 113); atencao = [System.Drawing.Color]::FromArgb(255, 193, 7)
  fora = [System.Drawing.Color]::FromArgb(231, 76, 60); desconhecido = [System.Drawing.Color]::FromArgb(149, 165, 166)
}
$script:iconeAtual = $null
$script:cacheIcones = @{}   # no maximo 4 estados x 11 contagens: o numero de handles de icone fica limitado (sem DestroyIcon)
function NovoIcone([string]$estado, [int]$numero) {
  $chaveCache = $estado + '|' + [string][Math]::Min($numero, 10)
  if ($script:cacheIcones.ContainsKey($chaveCache)) { return $script:cacheIcones[$chaveCache] }
  $cor = $script:cores[$estado]; if (-not $cor) { $cor = $script:cores['desconhecido'] }
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $pincel = New-Object System.Drawing.SolidBrush $cor
  $g.FillEllipse($pincel, 1, 1, 30, 30)
  $caneta = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(160, 0, 0, 0)), 2
  $g.DrawEllipse($caneta, 1, 1, 30, 30)
  if ($numero -gt 0) {
    $txt = if ($numero -gt 9) { '9+' } else { [string]$numero }
    $fonte = New-Object System.Drawing.Font 'Segoe UI', 15, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center; $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $sombra = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 0, 0))
    $g.DrawString($txt, $fonte, $sombra, (New-Object System.Drawing.RectangleF 1, 2, 32, 32), $fmt)
    $g.DrawString($txt, $fonte, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 1, 32, 32), $fmt)
    $fonte.Dispose(); $fmt.Dispose(); $sombra.Dispose()
  }
  $g.Dispose(); $pincel.Dispose(); $caneta.Dispose()
  $ico = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
  $bmp.Dispose()
  $script:cacheIcones[$chaveCache] = $ico
  return $ico
}

# ---------------------------------------------------------------------------------------------------------------------------------------------
$notify = New-Object System.Windows.Forms.NotifyIcon
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$notify.ContextMenuStrip = $menu
$script:ultimo = $null          # ultimo resumo bom
$script:erro = $null
$script:geralAnterior = $null

function ItemInfo([string]$texto, [bool]$negrito = $false) {
  $i = New-Object System.Windows.Forms.ToolStripMenuItem ($texto -replace '&', '&&')   # '&' num item de menu sublinha a letra seguinte
  if ($negrito) { $i.Font = New-Object System.Drawing.Font($i.Font, [System.Drawing.FontStyle]::Bold) }
  return $i
}

function Autoinicio { try { return [bool](Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'OceanoBandeja' -ErrorAction Stop) } catch { return $false } }
function DefinirAutoinicio([bool]$ligar) {
  $chave = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
  if ($ligar) {
    $cmd = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
    Set-ItemProperty -Path $chave -Name 'OceanoBandeja' -Value $cmd
  } else { Remove-ItemProperty -Path $chave -Name 'OceanoBandeja' -ErrorAction SilentlyContinue }
}

function MontarMenu {
  $menu.Items.Clear()
  $r = $script:ultimo
  if ($r) {
    $g = [string](Campo $r 'geral')
    $titulo = switch ($g) { 'ok' { 'Tudo certo' } 'atencao' { 'Atencao' } 'fora' { 'Algo fora do ar' } default { 'Sem leitura' } }
    [void]$menu.Items.Add((ItemInfo ($titulo + ' - atualizado as ' + (HoraDe (Campo $r 'geradoEm'))) $true))
    if ($script:erro) { [void]$menu.Items.Add((ItemInfo ('! ' + $script:erro + ' (mostrando o ultimo dado)'))) }
    [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    foreach ($par in @(@('VTEX', 'status.vtex'), @('GitHub', 'status.github'), @('Firebase', 'status.firebase'), @('Backup', 'backup'))) {
      $p = Campo $r $par[1]
      $linha = $par[0] + ': ' + (Rotulo ([string](Campo $p 'estado')))
      $t = [string](Campo $p 'texto'); if ($t -and ([string](Campo $p 'estado')) -ne 'ok') { $linha += ' - ' + $t }
      [void]$menu.Items.Add((ItemInfo $linha))
    }
    $al = Numero (Campo $r 'alarmesSumico.ultimas24h')
    [void]$menu.Items.Add((ItemInfo ('Cards sumindo (24 h): ' + $(if ($al -gt 0) { "$al card(s) sem exclusao" } else { 'nenhum alarme' }))))
    $ab = Numero (Campo $r 'plantao.abertos'); $val = Numero (Campo $r 'plantao.aguardandoValidacao'); $esc = Numero (Campo $r 'plantao.escalados')
    $pl = if ($ab -gt 0) { "$ab aberto(s)" + $(if ($val -gt 0) { " - $val p/ validar" } else { '' }) + $(if ($esc -gt 0) { " - $esc escalado(s)" } else { '' }) } else { 'nenhum bug aberto' }
    [void]$menu.Items.Add((ItemInfo ('Plantao de bugs: ' + $pl)))
    [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    $mc = Campo $r 'meusCards'
    if ($mc) {
      [void]$menu.Items.Add((ItemInfo ('Meus cards: ' + (Numero (Campo $mc 'atrasados')) + ' atrasados - ' + (Numero (Campo $mc 'venceHoje')) + ' hoje - ' + (Numero (Campo $mc 'bloqueados')) + ' bloqueados - ' + (Numero (Campo $mc 'venceEm7dias')) + ' em 7 dias') $true))
      $lista = @(Campo $mc 'lista')
      foreach ($c in ($lista | Select-Object -First 6)) {
        if ($null -eq $c) { continue }
        $tt = [string](Campo $c 'titulo'); if ($tt.Length -gt 55) { $tt = $tt.Substring(0, 52) + '...' }
        [void]$menu.Items.Add((ItemInfo ('   ' + $tt + '  [' + [string](Campo $c 'squad') + ']  ' + (QuandoDoCard $c))))
      }
      if ($lista.Count -eq 0 -or ($lista.Count -eq 1 -and $null -eq $lista[0])) { [void]$menu.Items.Add((ItemInfo '   Nada atrasado, bloqueado ou vencendo nos proximos 7 dias.')) }
    }
  } else {
    [void]$menu.Items.Add((ItemInfo $(if ($script:erro) { $script:erro } else { 'Carregando...' }) $true))
  }
  [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
  $iAtualizar = New-Object System.Windows.Forms.ToolStripMenuItem 'Atualizar agora'
  $iAtualizar.Add_Click({ Atualizar })
  [void]$menu.Items.Add($iAtualizar)
  $iWeb = New-Object System.Windows.Forms.ToolStripMenuItem 'Abrir mini painel (navegador)'
  $iWeb.Add_Click({ Start-Process $script:PaginaWeb })
  [void]$menu.Items.Add($iWeb)
  $iAuto = New-Object System.Windows.Forms.ToolStripMenuItem 'Iniciar com o Windows'
  $iAuto.Checked = (Autoinicio)
  $iAuto.Add_Click({ try { DefinirAutoinicio (-not (Autoinicio)) } catch { [System.Windows.Forms.MessageBox]::Show('Nao consegui mudar o inicio automatico: ' + $_.Exception.Message, 'Oceano') | Out-Null } })
  [void]$menu.Items.Add($iAuto)
  $iSair = New-Object System.Windows.Forms.ToolStripMenuItem 'Sair'
  $iSair.Add_Click({ $script:notify.Visible = $false; [System.Windows.Forms.Application]::Exit() })
  [void]$menu.Items.Add($iSair)
}

function Atualizar {
  try {
    $res = Buscar
    if ($res.ok) { $script:ultimo = $res.resumo; $script:erro = $null } else { $script:erro = $res.erro }
    $r = $script:ultimo
    $estado = if ($r) { [string](Campo $r 'geral') } else { 'desconhecido' }
    $atrasados = if ($r) { Numero (Campo $r 'meusCards.atrasados') } else { 0 }
    $novo = NovoIcone $(if ($script:erro) { 'desconhecido' } else { $estado }) $atrasados
    $notify.Icon = $novo
    $script:iconeAtual = $novo
    # dica ao passar o mouse (limite de 63 caracteres do Windows)
    $dica = if ($r) { 'Oceano: ' + $(switch ($estado) { 'ok' { 'tudo certo' } 'atencao' { 'atencao' } 'fora' { 'fora do ar' } default { 'sem leitura' } }) + $(if ($atrasados -gt 0) { " | $atrasados atrasado(s)" } else { '' }) + $(if ($script:erro) { ' | sem conexao' } else { '' }) } else { 'Oceano: ' + $(if ($script:erro) { $script:erro } else { 'carregando' }) }
    if ($dica.Length -gt 63) { $dica = $dica.Substring(0, 63) }
    $notify.Text = $dica
    # aviso quando PIORA (ok -> atencao/fora, atencao -> fora)
    if ($r -and -not $script:erro) {
      if ($null -ne $script:geralAnterior -and (Gravidade $estado) -gt (Gravidade $script:geralAnterior)) {
        $motivos = @()
        foreach ($par in @(@('VTEX', 'status.vtex'), @('GitHub', 'status.github'), @('Firebase', 'status.firebase'), @('Backup', 'backup'))) {
          $e = [string](Campo (Campo $r $par[1]) 'estado'); if ($e -eq 'atencao' -or $e -eq 'fora') { $motivos += ($par[0] + ': ' + (Rotulo $e)) }
        }
        if ((Numero (Campo $r 'alarmesSumico.ultimas24h')) -gt 0) { $motivos += 'cards sumindo' }
        if ((Numero (Campo $r 'plantao.escalados')) -gt 0) { $motivos += 'bug escalado' }
        if ($motivos.Count -eq 0) { $motivos = @('veja o menu do icone') }   # o balao nao aceita texto vazio
        $notify.ShowBalloonTip(8000, $(if ($estado -eq 'fora') { 'Oceano: algo fora do ar' } else { 'Oceano: atencao' }), ($motivos -join ' | '), $(if ($estado -eq 'fora') { [System.Windows.Forms.ToolTipIcon]::Error } else { [System.Windows.Forms.ToolTipIcon]::Warning }))
      }
      $script:geralAnterior = $estado
    }
    MontarMenu
  } catch {
    $notify.Text = 'Oceano: erro inesperado'
    Registrar ('ERRO ao atualizar: ' + $_.Exception.Message)
    if ($Visivel) { Write-Host ('ERRO ao atualizar: ' + $_.Exception.Message) }
  }
}

# clique esquerdo abre o menu (por padrao so o direito abre); duplo clique abre a pagina
$notify.Add_MouseClick({
  param($remetente, $e)
  if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
    $m = [System.Windows.Forms.NotifyIcon].GetMethod('ShowContextMenu', [System.Reflection.BindingFlags]'Instance,NonPublic')
    [void]$m.Invoke($script:notify, $null)
  }
})
$notify.Add_DoubleClick({ Start-Process $script:PaginaWeb })

$notify.Icon = NovoIcone 'desconhecido' 0
$script:iconeAtual = $notify.Icon
$notify.Text = 'Oceano: carregando'
$notify.Visible = $true
MontarMenu

$temporizador = New-Object System.Windows.Forms.Timer
$temporizador.Interval = [Math]::Max(15, $IntervaloSegundos) * 1000
$temporizador.Add_Tick({ Atualizar })
$temporizador.Start()
Atualizar

try { [System.Windows.Forms.Application]::Run() }
finally {
  $temporizador.Stop(); $notify.Visible = $false; $notify.Dispose(); $menu.Dispose()
  $script:mutex.ReleaseMutex() | Out-Null; $script:mutex.Dispose()
}
