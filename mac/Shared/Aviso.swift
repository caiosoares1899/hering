import Foundation

/// Decide SE e O QUE avisar quando o painel muda (02/11/2026). Pura (sem tela, sem rede): compara a leitura anterior com a nova.
/// Avisa quando a cor piora, quando melhora/volta ao normal, ou quando aparece/some um problema mesmo com a cor igual.
/// Não avisa quando só mudou entre "ok", "sem leitura" e "desligado". Mesma regra do ícone da bandeja do Windows.
enum Aviso {
    typealias Foto = (estado: Estado, problemas: [String])

    static func gravidade(_ e: Estado) -> Int {
        switch e {
        case .fora: return 2
        case .atencao: return 1
        default: return 0
        }
    }

    static func de(antes: Foto, depois: Foto) -> (titulo: String, corpo: String)? {
        let novos = depois.problemas.filter { !antes.problemas.contains($0) }
        let resolvidos = antes.problemas.filter { !depois.problemas.contains($0) }
        let g0 = gravidade(antes.estado)
        let g1 = gravidade(depois.estado)
        if g0 == g1 && novos.isEmpty && resolvidos.isEmpty { return nil }

        if g1 > g0 {
            let titulo = depois.estado == .fora ? "🔴 Oceano: algo fora do ar" : "🟡 Oceano: atenção"
            let corpo = depois.problemas.isEmpty ? "Veja o menu do ícone." : depois.problemas.joined(separator: " · ")
            return (titulo, corpo)
        }
        if g1 == 0 && g0 > 0 {
            let corpo = resolvidos.isEmpty ? "Tudo certo agora." : "Resolvido: " + resolvidos.joined(separator: " · ")
            return ("🟢 Oceano: voltou ao normal", corpo)
        }
        var partes: [String] = []
        if !novos.isEmpty { partes.append("Novo: " + novos.joined(separator: " · ")) }
        if !resolvidos.isEmpty { partes.append("Resolvido: " + resolvidos.joined(separator: " · ")) }
        let corpo = partes.isEmpty ? "Veja o menu do ícone." : partes.joined(separator: "  ")
        return (g1 < g0 ? "🟡 Oceano: melhorou" : "Oceano: mudou", corpo)
    }
}
