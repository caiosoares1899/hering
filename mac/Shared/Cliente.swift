import Foundation

enum ErroResumo: LocalizedError {
    case semChave
    case chaveRecusada
    case limite
    case http(Int)
    case rede(String)
    case formato

    var errorDescription: String? {
        switch self {
        case .semChave: return "Sem chave: preencha OCEANO_CHAVE em mac/Local.xcconfig e gere o projeto de novo."
        case .chaveRecusada: return "A função recusou a chave (confira OCEANO_RESUMO_KEY)."
        case .limite: return "Muitas consultas nesta hora; tente de novo em alguns minutos."
        case .http(let c): return "A função respondeu com erro (HTTP \(c))."
        case .rede(let m): return "Sem conexão com a função: \(m)"
        case .formato: return "A resposta da função veio num formato inesperado."
        }
    }
}

enum Cliente {
    /// Consulta o `oceanoResumo`. Usado pelo app da barra de menu e pelo widget.
    static func buscar() async throws -> Resumo {
        guard !Config.chave.isEmpty, let url = Config.urlResumo else { throw ErroResumo.semChave }
        var pedido = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        pedido.httpMethod = "GET"
        let dados: Data
        let resposta: URLResponse
        do {
            (dados, resposta) = try await URLSession.shared.data(for: pedido)
        } catch {
            throw ErroResumo.rede(error.localizedDescription)
        }
        guard let http = resposta as? HTTPURLResponse else { throw ErroResumo.formato }
        switch http.statusCode {
        case 200:
            do { return try JSONDecoder().decode(Resumo.self, from: dados) } catch { throw ErroResumo.formato }
        case 403: throw ErroResumo.chaveRecusada
        case 429: throw ErroResumo.limite
        default: throw ErroResumo.http(http.statusCode)
        }
    }
}
