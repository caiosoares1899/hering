import WidgetKit
import SwiftUI

struct Entrada: TimelineEntry {
    let date: Date
    let resumo: Resumo?
    let erro: String?
}

struct Provedor: TimelineProvider {
    func placeholder(in context: Context) -> Entrada {
        Entrada(date: Date(), resumo: nil, erro: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (Entrada) -> Void) {
        Task {
            completion(await carregar())
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entrada>) -> Void) {
        Task {
            let entrada = await carregar()
            // O sistema decide quando atualizar de fato (algumas vezes por hora); pedimos de 15 em 15 minutos.
            let proxima = Date().addingTimeInterval(15 * 60)
            completion(Timeline(entries: [entrada], policy: .after(proxima)))
        }
    }

    private func carregar() async -> Entrada {
        do {
            return Entrada(date: Date(), resumo: try await Cliente.buscar(), erro: nil)
        } catch {
            return Entrada(date: Date(), resumo: nil, erro: error.localizedDescription)
        }
    }
}

struct OceanoWidgetView: View {
    @Environment(\.widgetFamily) private var familia
    let entrada: Entrada

    var body: some View {
        if let r = entrada.resumo {
            conteudo(r)
        } else if let e = entrada.erro {
            VStack(alignment: .leading, spacing: 6) {
                Text("⚪️ Mini painel").font(.headline)
                Text(e).font(.caption).foregroundStyle(.secondary)
            }
        } else {
            Text("Mini painel").font(.headline)
        }
    }

    @ViewBuilder
    private func conteudo(_ r: Resumo) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(r.estadoGeral.emoji).font(.title2)
                VStack(alignment: .leading, spacing: 0) {
                    Text(r.tituloGeral).font(.headline)
                    Text("às \(r.horaGerado)").font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
            }
            HStack(spacing: 10) {
                bolinha("VTEX", r.status?.vtex)
                bolinha("GitHub", r.status?.github)
                bolinha("Firebase", r.status?.firebase)
                bolinha("Backup", r.backup)
            }
            if let mc = r.meusCards {
                Text("\(mc.atrasados ?? 0) atrasados · \(mc.venceHoje ?? 0) hoje · \(mc.bloqueados ?? 0) bloq.")
                    .font(.caption.bold())
                if familia == .systemMedium {
                    ForEach((mc.lista ?? []).prefix(3)) { c in
                        HStack(spacing: 6) {
                            Text(c.titulo ?? "").lineLimit(1).font(.caption)
                            Spacer(minLength: 4)
                            Text(c.quando.texto).font(.caption2.bold()).foregroundStyle(c.quando.cor)
                        }
                    }
                }
            }
        }
    }

    private func bolinha(_ nome: String, _ p: Resumo.Peca?) -> some View {
        let e = Estado(p?.estado)
        return VStack(spacing: 1) {
            Text(e.emoji).font(.caption)
            Text(nome).font(.system(size: 8)).foregroundStyle(.secondary)
        }
    }
}

@main
struct OceanoWidget: Widget {
    let kind = "OceanoWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provedor()) { entrada in
            OceanoWidgetView(entrada: entrada)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Oceano · mini painel")
        .description("VTEX, GitHub, Firebase, backup e os seus cards, para bater o olho.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
