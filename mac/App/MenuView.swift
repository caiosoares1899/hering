import SwiftUI
import ServiceManagement

struct MenuView: View {
    @ObservedObject var modelo: Modelo
    @State private var abrirNoLogin = (SMAppService.mainApp.status == .enabled)

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            cabecalho
            if let r = modelo.resumo {
                secaoSistema(r)
                secaoRotina(r)
                secaoCards(r)
            } else if modelo.erro == nil {
                Text("Carregando…").foregroundStyle(.secondary)
            }
            if let e = modelo.erro {
                Text(e)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Divider()
            rodape
        }
        .padding(14)
        .frame(width: 360)
    }

    // MARK: cabeçalho

    private var cabecalho: some View {
        HStack(spacing: 10) {
            Text(modelo.resumo?.estadoGeral.emoji ?? "⚪️").font(.system(size: 28))
            VStack(alignment: .leading, spacing: 2) {
                Text(modelo.resumo?.tituloGeral ?? "Mini painel").font(.headline)
                Text(subtitulo).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                Task { await modelo.atualizar() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.borderless)
            .help("Atualizar agora")
            .disabled(modelo.atualizando)
        }
    }

    private var subtitulo: String {
        guard let r = modelo.resumo else { return "Oceano · para bater o olho" }
        return modelo.erro == nil ? "Atualizado às \(r.horaGerado)" : "Sem conexão · último dado às \(r.horaGerado)"
    }

    // MARK: seções

    private func linhaPeca(_ nome: String, _ icone: String, _ p: Resumo.Peca?) -> some View {
        let e = Estado(p?.estado)
        return HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(icone)
            Text(nome).fontWeight(.medium)
            Spacer()
            Text("\(e.emoji) \(e.rotulo)").font(.caption.bold()).foregroundStyle(e.cor)
        }
        .help(p?.texto ?? "sem leitura")
    }

    private func detalhe(_ p: Resumo.Peca?) -> some View {
        let e = Estado(p?.estado)
        return Group {
            if e != .ok, let t = p?.texto, !t.isEmpty {
                Text(t).font(.caption).foregroundStyle(.secondary).padding(.leading, 22)
            }
        }
    }

    private func secaoSistema(_ r: Resumo) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            titulo("Sistema")
            linhaPeca("VTEX", "🛒", r.status?.vtex)
            detalhe(r.status?.vtex)
            linhaPeca("GitHub", "🐙", r.status?.github)
            detalhe(r.status?.github)
            linhaPeca("Firebase", "🔥", r.status?.firebase)
            detalhe(r.status?.firebase)
        }
    }

    private func secaoRotina(_ r: Resumo) -> some View {
        let alarmes = r.alarmesSumico?.ultimas24h ?? 0
        let alarmePeca = Resumo.Peca(estado: alarmes > 0 ? "atencao" : "ok",
                                     texto: alarmes > 0 ? "\(alarmes) card(s) sumiram sem exclusão nas últimas 24 h" : "nenhum alarme")
        let pl = r.plantao
        let plEstado = (pl?.escalados ?? 0) > 0 ? "atencao" : "ok"
        var plTexto = "nenhum bug aberto"
        if let abertos = pl?.abertos, abertos > 0 {
            plTexto = "\(abertos) aberto(s)"
            if let v = pl?.aguardandoValidacao, v > 0 { plTexto += " · \(v) p/ validar" }
            if let esc = pl?.escalados, esc > 0 { plTexto += " · \(esc) escalado(s)" }
        }
        let plantaoPeca = Resumo.Peca(estado: plEstado, texto: plTexto)
        return VStack(alignment: .leading, spacing: 4) {
            titulo("Dados e rotina")
            linhaPeca("Backup", "💾", r.backup)
            detalhe(r.backup)
            linhaPeca("Cards sumindo (24 h)", "👻", alarmePeca)
            detalhe(alarmePeca)
            linhaPeca("Plantão de bugs", "🐛", plantaoPeca)
            detalhe(plantaoPeca)
        }
    }

    private func secaoCards(_ r: Resumo) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            titulo("Meus cards")
            if let mc = r.meusCards {
                HStack(spacing: 8) {
                    contador(mc.atrasados ?? 0, "atrasados", .red)
                    contador(mc.venceHoje ?? 0, "hoje", .orange)
                    contador(mc.bloqueados ?? 0, "bloqueados", .orange)
                    contador(mc.venceEm7dias ?? 0, "7 dias", .primary)
                }
                let lista = mc.lista ?? []
                if lista.isEmpty {
                    Text("🎉 Nada atrasado, bloqueado ou vencendo nos próximos 7 dias.")
                        .font(.caption).foregroundStyle(.secondary)
                } else {
                    ForEach(lista.prefix(6)) { c in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(c.titulo ?? "(sem título)").lineLimit(2).font(.callout)
                            Spacer(minLength: 6)
                            Text(c.squad ?? "").font(.caption2).foregroundStyle(.secondary)
                            Text(c.quando.texto).font(.caption.bold()).foregroundStyle(c.quando.cor)
                        }
                    }
                }
            } else {
                Text("Sem leitura dos seus cards.").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func contador(_ n: Int, _ rotulo: String, _ cor: Color) -> some View {
        VStack(spacing: 0) {
            Text("\(n)").font(.title2.bold()).foregroundStyle(n > 0 ? cor : .primary)
            Text(rotulo).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 8).fill(.quaternary))
    }

    private func titulo(_ t: String) -> some View {
        Text(t.uppercased()).font(.caption2.bold()).foregroundStyle(.secondary).padding(.top, 2)
    }

    // MARK: rodapé

    private var rodape: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle("Abrir ao iniciar sessão", isOn: Binding(
                get: { abrirNoLogin },
                set: { novo in
                    do {
                        if novo { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                        abrirNoLogin = novo
                    } catch {
                        abrirNoLogin = (SMAppService.mainApp.status == .enabled)
                    }
                }))
                .toggleStyle(.checkbox)
            HStack {
                Button("Abrir mini painel") { NSWorkspace.shared.open(Config.urlMiniPainel) }
                Spacer()
                Button("Sair") { NSApplication.shared.terminate(nil) }
            }
        }
    }
}
