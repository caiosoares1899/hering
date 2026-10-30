import Foundation
import SwiftUI

/// Estado de uma peça: cor + ícone + texto (nunca só cor), como no mini painel web.
enum Estado {
    case ok, atencao, fora, off, desconhecido

    init(_ texto: String?) {
        switch texto {
        case "ok": self = .ok
        case "atencao": self = .atencao
        case "fora": self = .fora
        case "off": self = .off
        default: self = .desconhecido
        }
    }

    var emoji: String {
        switch self {
        case .ok: return "🟢"
        case .atencao: return "🟡"
        case .fora: return "🔴"
        case .off, .desconhecido: return "⚪️"
        }
    }

    var rotulo: String {
        switch self {
        case .ok: return "OK"
        case .atencao: return "Atenção"
        case .fora: return "Fora do ar"
        case .off: return "Desligado"
        case .desconhecido: return "Sem leitura"
        }
    }

    var cor: Color {
        switch self {
        case .ok: return .green
        case .atencao: return .orange
        case .fora: return .red
        case .off, .desconhecido: return .secondary
        }
    }
}

extension Resumo {
    var estadoGeral: Estado { Estado(geral) }

    var tituloGeral: String {
        switch estadoGeral {
        case .ok: return "Tudo certo"
        case .atencao: return "Atenção"
        case .fora: return "Algo fora do ar"
        default: return "Sem leitura"
        }
    }

    /// Texto curto da barra de menu: a bolinha e, se houver, quantos cards estão atrasados.
    var rotuloBarra: String {
        let atrasados = meusCards?.atrasados ?? 0
        return estadoGeral.emoji + (atrasados > 0 ? " \(atrasados)" : "")
    }

    /// "HH:mm" do momento em que o servidor gerou o resumo.
    var horaGerado: String { Resumo.hora(geradoEm) }

    static func hora(_ iso: String?) -> String {
        guard let iso = iso else { return "--:--" }
        let comFracao = ISO8601DateFormatter()
        comFracao.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let simples = ISO8601DateFormatter()
        simples.formatOptions = [.withInternetDateTime]
        guard let data = comFracao.date(from: iso) ?? simples.date(from: iso) else { return "--:--" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "HH:mm"
        return f.string(from: data)
    }
}

extension Resumo.Card {
    /// ("atrasado 10 dias", vermelho) · ("bloqueado", laranja) · ("vence hoje", laranja) · ("vence 04/11", normal)
    var quando: (texto: String, cor: Color) {
        if atrasado == true {
            let d = diasAtraso ?? 1
            return ("atrasado \(d) \(d == 1 ? "dia" : "dias")", .red)
        }
        if bloqueado == true { return ("bloqueado", .orange) }
        if venceHoje == true { return ("vence hoje", .orange) }
        if let p = prazo {
            let partes = p.split(separator: "-")
            if partes.count == 3 { return ("vence \(partes[2])/\(partes[1])", .secondary) }
        }
        return ("sem prazo", .secondary)
    }
}
