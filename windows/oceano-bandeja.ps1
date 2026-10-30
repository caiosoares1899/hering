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
  switch ($estado) { 'ok' { 'OK' } 'atencao' { 'ATENÇÃO' } 'fora' { 'FORA DO AR' } 'off' { 'desligado' } default { 'sem leitura' } }
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

function Autoinicio { try { return [bool](Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'OceanoBandeja' -ErrorAction Stop) } catch { return $false } }
function DefinirAutoinicio([bool]$ligar) {
  $chave = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
  if ($ligar) {
    $cmd = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
    Set-ItemProperty -Path $chave -Name 'OceanoBandeja' -Value $cmd
  } else { Remove-ItemProperty -Path $chave -Name 'OceanoBandeja' -ErrorAction SilentlyContinue }
}

# ---------------------------------------------------------------------------------------------------------------------------------------------
# JANELA NATIVA: clicar no icone abre um painel desenhado aqui mesmo (WinForms), sem navegador. Fecha ao clicar fora ou com Esc; clicar no icone de novo tambem fecha.
$script:LARGURA = 380
$script:cFundo = [System.Drawing.Color]::FromArgb(7, 26, 46)
$script:cCartao = [System.Drawing.Color]::FromArgb(13, 42, 69)
$script:cCartaoHover = [System.Drawing.Color]::FromArgb(24, 64, 102)
$script:cBorda = [System.Drawing.Color]::FromArgb(42, 111, 156)
$script:cTexto = [System.Drawing.Color]::FromArgb(232, 244, 253)
$script:cCinza = [System.Drawing.Color]::FromArgb(143, 176, 201)
$script:fN = New-Object System.Drawing.Font('Segoe UI', 10)
$script:fNegrito = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$script:fTitulo = New-Object System.Drawing.Font('Segoe UI', 14.5, [System.Drawing.FontStyle]::Bold)
$script:fPeq = New-Object System.Drawing.Font('Segoe UI', 8.5)
$script:fPeqNegrito = New-Object System.Drawing.Font('Segoe UI', 8.5, [System.Drawing.FontStyle]::Bold)
$script:fGrande = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
$script:fBolinha = New-Object System.Drawing.Font('Segoe UI', 22)
$script:painel = $null
$script:painelAbertoEm = [datetime]::MinValue
$script:painelFechadoEm = [datetime]::MinValue
$script:py = 0

function CorDoEstado([string]$e) {
  switch ($e) {
    'ok' { [System.Drawing.Color]::FromArgb(46, 204, 113) }
    'atencao' { [System.Drawing.Color]::FromArgb(255, 193, 7) }
    'fora' { [System.Drawing.Color]::FromArgb(231, 76, 60) }
    default { [System.Drawing.Color]::FromArgb(149, 165, 166) }
  }
}
function CorDoCard($c) {
  if (Campo $c 'atrasado') { return [System.Drawing.Color]::FromArgb(231, 76, 60) }
  if ((Campo $c 'bloqueado') -or (Campo $c 'venceHoje')) { return [System.Drawing.Color]::FromArgb(255, 193, 7) }
  return $script:cCinza
}
function Corta([string]$t, [int]$n) { if ($t.Length -gt $n) { return $t.Substring(0, $n - 1) + '…' } else { return $t } }

function CaminhoArredondado([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function NovoRotulo($pai, [string]$texto, [int]$x, [int]$y, [int]$w, [int]$h, $fonte, $cor, [string]$alinho = 'Esq') {
  $l = New-Object System.Windows.Forms.Label
  $l.AutoSize = $false
  $l.Text = $texto
  $l.Location = New-Object System.Drawing.Point($x, $y)
  $l.Size = New-Object System.Drawing.Size($w, $h)
  $l.Font = $fonte
  $l.ForeColor = $cor
  $l.BackColor = [System.Drawing.Color]::Transparent
  $l.TextAlign = switch ($alinho) { 'Dir' { [System.Drawing.ContentAlignment]::MiddleRight } 'Cen' { [System.Drawing.ContentAlignment]::MiddleCenter } default { [System.Drawing.ContentAlignment]::MiddleLeft } }
  $pai.Controls.Add($l)
  return $l
}

# botao simples (rotulo com fundo de cartao + efeito ao passar o mouse); a acao vai em .Tag
function NovoBotao($pai, [string]$texto, [string]$acao, [int]$x, [int]$y, [int]$w, [int]$h) {
  $l = NovoRotulo $pai $texto $x $y $w $h $script:fN $script:cTexto 'Cen'
  $l.BackColor = $script:cCartao
  $l.Tag = $acao
  $l.Cursor = [System.Windows.Forms.Cursors]::Hand
  $l.Add_MouseEnter($script:aoEntrar)
  $l.Add_MouseLeave($script:aoSair)
  $l.Add_Click($script:aoClicarAcao)
  return $l
}

function TextoAutoinicio { if (Autoinicio) { 'Iniciar com o Windows: sim' } else { 'Iniciar com o Windows: não' } }

$script:aoEntrar = { param($s, $e) if ($s.Tag -ne 'auto') { $s.BackColor = $script:cCartaoHover } else { $s.ForeColor = $script:cTexto } }
$script:aoSair = { param($s, $e) if ($s.Tag -ne 'auto') { $s.BackColor = $script:cCartao } else { $s.ForeColor = $script:cCinza } }
$script:aoClicarAcao = {
  param($s, $e)
  switch ([string]$s.Tag) {
    'atualizar' { Atualizar; if ($script:painel -and -not $script:painel.IsDisposed) { $script:painel.Close() }; MostrarPainel }
    'pagina' { if ($script:painel -and -not $script:painel.IsDisposed) { $script:painel.Close() }; Start-Process $script:PaginaWeb }
    'sair' { $script:notify.Visible = $false; [System.Windows.Forms.Application]::Exit() }
    'auto' {
      try { DefinirAutoinicio (-not (Autoinicio)) } catch { [System.Windows.Forms.MessageBox]::Show('Não consegui mudar o início automático: ' + $_.Exception.Message, 'Oceano') | Out-Null }
      $s.Text = TextoAutoinicio
    }
  }
}

function SecaoPainel($f, [string]$titulo) {
  [void](NovoRotulo $f $titulo.ToUpper() 18 $script:py ($script:LARGURA - 36) 16 $script:fPeqNegrito $script:cCinza)
  $script:py += 20
}

function LinhaPeca($f, [string]$nome, $peca) {
  $e = [string](Campo $peca 'estado')
  $cor = CorDoEstado $e
  [void](NovoRotulo $f '●' 16 $script:py 22 22 $script:fN $cor 'Cen')
  $t = [string](Campo $peca 'texto')
  $ok = ($e -eq 'ok')
  # OK: o detalhe ("operando", "em dia"...) vai na mesma linha, em cinza, encostado no "OK"; nos demais estados vai embaixo, mais longo
  $wRotulo = if ($ok) { 44 } else { 120 }
  [void](NovoRotulo $f $nome 40 $script:py 112 22 $script:fN $script:cTexto)
  [void](NovoRotulo $f (Rotulo $e) ($script:LARGURA - 18 - $wRotulo) $script:py $wRotulo 22 $script:fPeqNegrito $cor 'Dir')
  if ($ok -and $t) { [void](NovoRotulo $f (Corta $t 30) 156 $script:py ($script:LARGURA - 18 - $wRotulo - 156 - 2) 22 $script:fPeq $script:cCinza 'Dir') }
  $script:py += 22
  if (-not $ok -and $t) {
    [void](NovoRotulo $f (Corta $t 60) 40 $script:py ($script:LARGURA - 58) 18 $script:fPeq $script:cCinza)
    $script:py += 20
  }
  $script:py += 4
}

# quantos cards cabem na janela, e o teto que a funcao oceanoResumo manda na lista (MAX_CARDS_LISTA em functions/oceano/resumo.js; o teste contrato_windows confere)
$MAX_LINHAS_CARDS = 5
$MAX_LISTA_FUNCAO = 8

function MostrarPainel {
  if ($script:painel -and -not $script:painel.IsDisposed) { $script:painel.Close(); return }
  $W = $script:LARGURA
  $r = $script:ultimo
  $f = New-Object System.Windows.Forms.Form
  $f.FormBorderStyle = 'None'
  $f.StartPosition = 'Manual'
  $f.ShowInTaskbar = $false
  $f.TopMost = $true
  $f.KeyPreview = $true
  $f.BackColor = $script:cFundo
  $f.Width = $W
  $f.SuspendLayout()

  # cabecalho
  $g = if ($r) { [string](Campo $r 'geral') } else { 'desconhecido' }
  if ($script:erro -and -not $r) { $g = 'desconhecido' }
  $titulo = switch ($g) { 'ok' { 'Tudo certo' } 'atencao' { 'Atenção' } 'fora' { 'Algo fora do ar' } default { 'Sem leitura' } }
  $sub = if ($r) { 'Atualizado às ' + (HoraDe (Campo $r 'geradoEm')) } elseif ($script:erro) { $script:erro } else { 'Carregando…' }
  if ($r -and $script:erro) { $sub += ' · sem conexão, mostrando o último dado' }
  [void](NovoRotulo $f '●' 14 12 40 44 $script:fBolinha (CorDoEstado $g) 'Cen')
  [void](NovoRotulo $f $titulo 58 14 ($W - 58 - 90) 26 $script:fTitulo $script:cTexto)
  [void](NovoRotulo $f (Corta $sub 52) 58 40 ($W - 58 - 90) 18 $script:fPeq $script:cCinza)
  $atualizar = NovoRotulo $f 'Atualizar' ($W - 18 - 76) 16 76 24 $script:fPeqNegrito $script:cCinza 'Dir'
  $atualizar.Tag = 'atualizar'; $atualizar.Cursor = [System.Windows.Forms.Cursors]::Hand
  $atualizar.Add_Click($script:aoClicarAcao)
  $script:py = 70

  if ($r) {
    SecaoPainel $f 'Sistema'
    LinhaPeca $f 'VTEX' (Campo $r 'status.vtex')
    LinhaPeca $f 'GitHub' (Campo $r 'status.github')
    LinhaPeca $f 'Firebase' (Campo $r 'status.firebase')
    $script:py += 4
    SecaoPainel $f 'Dados e rotina'
    LinhaPeca $f 'Backup' (Campo $r 'backup')
    $al = Numero (Campo $r 'alarmesSumico.ultimas24h')
    LinhaPeca $f 'Cards sumindo' @{ estado = $(if ($al -gt 0) { 'atencao' } else { 'ok' }); texto = $(if ($al -gt 0) { "$al card(s) sumiram sem exclusão nas últimas 24 h" } else { 'nenhum em 24 h' }) }
    $ab = Numero (Campo $r 'plantao.abertos'); $val = Numero (Campo $r 'plantao.aguardandoValidacao'); $esc = Numero (Campo $r 'plantao.escalados')
    $plTexto = if ($ab -gt 0) { "$ab aberto(s)" + $(if ($val -gt 0) { " · $val p/ validar" } else { '' }) + $(if ($esc -gt 0) { " · $esc escalado(s)" } else { '' }) } else { '' }
    LinhaPeca $f 'Plantão de bugs' @{ estado = $(if ($esc -gt 0) { 'atencao' } else { 'ok' }); texto = $(if ($plTexto) { $plTexto } else { 'nada aberto' }) }
    $script:py += 4

    $mc = Campo $r 'meusCards'
    SecaoPainel $f 'Meus cards'
    if ($mc) {
      $bw = [int](($W - 36 - 18) / 4)
      $nums = @(
        @((Numero (Campo $mc 'atrasados')), 'atrasados', [System.Drawing.Color]::FromArgb(231, 76, 60)),
        @((Numero (Campo $mc 'venceHoje')), 'hoje', [System.Drawing.Color]::FromArgb(255, 193, 7)),
        @((Numero (Campo $mc 'bloqueados')), 'bloqueados', [System.Drawing.Color]::FromArgb(255, 193, 7)),
        @((Numero (Campo $mc 'venceEm7dias')), 'em 7 dias', $script:cTexto)
      )
      for ($i = 0; $i -lt 4; $i++) {
        $box = New-Object System.Windows.Forms.Panel
        $box.Location = New-Object System.Drawing.Point((18 + $i * ($bw + 6)), $script:py)
        $box.Size = New-Object System.Drawing.Size($bw, 52)
        $box.BackColor = $script:cCartao
        $cor = if ($nums[$i][0] -gt 0) { $nums[$i][2] } else { $script:cTexto }
        [void](NovoRotulo $box ([string]$nums[$i][0]) 0 2 $bw 30 $script:fGrande $cor 'Cen')
        [void](NovoRotulo $box $nums[$i][1] 0 32 $bw 16 $script:fPeq $script:cCinza 'Cen')
        $f.Controls.Add($box)
      }
      $script:py += 60
      $todos = @(@(Campo $mc 'lista') | Where-Object { $null -ne $_ })
      $lista = $todos | Select-Object -First $MAX_LINHAS_CARDS
      if (@($lista).Count -eq 0) {
        [void](NovoRotulo $f 'Nada atrasado, bloqueado ou vencendo nos próximos 7 dias.' 18 $script:py ($W - 36) 22 $script:fPeq $script:cCinza)
        $script:py += 26
      } else {
        foreach ($c in $lista) {
          [void](NovoRotulo $f (Corta ([string](Campo $c 'titulo')) 33) 18 $script:py ($W - 36 - 130) 22 $script:fN $script:cTexto)
          [void](NovoRotulo $f ((QuandoDoCard $c) + ' · ' + [string](Campo $c 'squad')) ($W - 18 - 150) $script:py 150 22 $script:fPeqNegrito (CorDoCard $c) 'Dir')
          $script:py += 24
        }
        # a funcao manda no maximo $MAX_LISTA_FUNCAO cards; se veio cheia, o total real e desconhecido: so se sabe o minimo (os contadores acima)
        $cheia = ($todos.Count -ge $MAX_LISTA_FUNCAO)
        $total = if ($cheia) { [Math]::Max($todos.Count, [Math]::Max((Numero (Campo $mc 'atrasados')) + (Numero (Campo $mc 'venceHoje')) + (Numero (Campo $mc 'venceEm7dias')), (Numero (Campo $mc 'bloqueados')))) } else { $todos.Count }
        $ocultos = $total - @($lista).Count
        if ($ocultos -gt 0) {
          $mais = [string]::Format('+ {0}{1} · abrir página inteira', $ocultos, $(if ($cheia) { ' ou mais' } else { '' }))
          $lm = NovoRotulo $f $mais 18 $script:py ($W - 36) 20 $script:fPeqNegrito $script:cCinza
          $lm.Tag = 'pagina'; $lm.Cursor = [System.Windows.Forms.Cursors]::Hand
          $lm.Add_Click($script:aoClicarAcao)
          $script:py += 24
        }
      }
    } else {
      [void](NovoRotulo $f 'Sem leitura dos seus cards.' 18 $script:py ($W - 36) 22 $script:fPeq $script:cCinza)
      $script:py += 26
    }
  } else {
    [void](NovoRotulo $f $(if ($script:erro) { $script:erro } else { 'Carregando…' }) 18 $script:py ($W - 36) 44 $script:fN $script:cTexto)
    $script:py += 50
  }

  # rodape
  $script:py += 4
  $linha = New-Object System.Windows.Forms.Panel
  $linha.Location = New-Object System.Drawing.Point(18, $script:py); $linha.Size = New-Object System.Drawing.Size(($W - 36), 1); $linha.BackColor = $script:cBorda
  $f.Controls.Add($linha)
  $script:py += 10
  [void](NovoBotao $f 'Abrir página inteira' 'pagina' 18 $script:py 214 28)
  [void](NovoBotao $f 'Sair' 'sair' (18 + 214 + 6) $script:py ($W - 36 - 214 - 6) 28)
  $script:py += 34
  $auto = NovoRotulo $f (TextoAutoinicio) 18 $script:py ($W - 36) 24 $script:fPeq $script:cCinza
  $auto.Tag = 'auto'; $auto.Cursor = [System.Windows.Forms.Cursors]::Hand
  $auto.Add_MouseEnter($script:aoEntrar); $auto.Add_MouseLeave($script:aoSair); $auto.Add_Click($script:aoClicarAcao)
  $script:py += 30

  $f.Height = $script:py
  $f.ResumeLayout($false)

  # cantos arredondados + borda; canto inferior direito da area util (acima da barra de tarefas)
  $f.Region = New-Object System.Drawing.Region (CaminhoArredondado 0 0 $W $f.Height 14)
  $f.Tag = (CaminhoArredondado 1 1 ($W - 2) ($f.Height - 2) 13)
  $f.Add_Paint({
    param($s, $e)
    $e.Graphics.SmoothingMode = 'AntiAlias'
    $pen = New-Object System.Drawing.Pen($script:cBorda, 1.5)
    $e.Graphics.DrawPath($pen, $s.Tag)
    $pen.Dispose()
  })
  $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $f.Location = New-Object System.Drawing.Point([Math]::Max($wa.Left, $wa.Right - $W - 12), [Math]::Max($wa.Top, $wa.Bottom - $f.Height - 12))

  $f.Add_Deactivate({ param($s, $e) if (((Get-Date) - $script:painelAbertoEm).TotalMilliseconds -gt 400) { $s.Close() } })
  $f.Add_KeyDown({ param($s, $e) if ($e.KeyCode -eq [System.Windows.Forms.Keys]::Escape) { $s.Close() } })
  $f.Add_FormClosed({ $script:painel = $null; $script:painelFechadoEm = Get-Date })
  $script:painel = $f
  $script:painelAbertoEm = Get-Date
  $f.Show()
  [void]$f.Activate()
}

# Menu do botao direito (curto): o resumo mora na janela.
function MontarMenuSimples {
  $menu.Items.Clear()
  $iAbrir = New-Object System.Windows.Forms.ToolStripMenuItem 'Abrir o mini painel'
  $iAbrir.Font = New-Object System.Drawing.Font($iAbrir.Font, [System.Drawing.FontStyle]::Bold)
  $iAbrir.Add_Click({ MostrarPainel })
  [void]$menu.Items.Add($iAbrir)
  $iAtualizar = New-Object System.Windows.Forms.ToolStripMenuItem 'Atualizar o ícone agora'
  $iAtualizar.Add_Click({ Atualizar })
  [void]$menu.Items.Add($iAtualizar)
  $iWeb = New-Object System.Windows.Forms.ToolStripMenuItem 'Abrir no navegador (página inteira)'
  $iWeb.Add_Click({ Start-Process $script:PaginaWeb })
  [void]$menu.Items.Add($iWeb)
  [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
  $iAuto = New-Object System.Windows.Forms.ToolStripMenuItem 'Iniciar com o Windows'
  $iAuto.Checked = (Autoinicio)
  $iAuto.Add_Click({ try { DefinirAutoinicio (-not (Autoinicio)) } catch { [System.Windows.Forms.MessageBox]::Show('Não consegui mudar o início automático: ' + $_.Exception.Message, 'Oceano') | Out-Null } })
  $script:itemAuto = $iAuto
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
  } catch {
    $notify.Text = 'Oceano: erro inesperado'
    Registrar ('ERRO ao atualizar: ' + $_.Exception.Message)
    if ($Visivel) { Write-Host ('ERRO ao atualizar: ' + $_.Exception.Message) }
  }
}

# clique esquerdo abre o painel nativo com o mini painel; o botao direito abre o menu curto
$notify.Add_MouseClick({
  param($remetente, $e)
  # clicar no icone com o painel aberto: o painel fecha sozinho ao perder o foco ANTES deste clique chegar; sem esta guarda ele reabriria na hora
  if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left -and (((Get-Date) - $script:painelFechadoEm).TotalMilliseconds -gt 400)) { MostrarPainel }
})
$notify.Add_BalloonTipClicked({ MostrarPainel })   # clicar no aviso abre o painel

$notify.Icon = NovoIcone 'desconhecido' 0
$script:iconeAtual = $notify.Icon
$notify.Text = 'Oceano: carregando'
$notify.Visible = $true
MontarMenuSimples
$menu.Add_Opening({ try { $script:itemAuto.Checked = (Autoinicio) } catch {} })   # o 'visto' reflete o estado real do registro

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
