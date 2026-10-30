import Foundation

/// Configuração lida do Info.plist (preenchida por `Local.xcconfig` na hora de gerar o projeto — ver mac/README.md).
/// A chave NUNCA fica no código nem no repositório: `Local.xcconfig` está no .gitignore.
enum Config {
    private static func texto(_ chave: String) -> String {
        let bruto = Bundle.main.object(forInfoDictionaryKey: chave) as? String ?? ""
        return bruto.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static var chave: String { texto("OceanoChave") }

    static var host: String {
        let h = texto("OceanoHost")
        return h.isEmpty ? "us-central1-hering-onboarding.cloudfunctions.net" : h
    }

    /// https://<host>/oceanoResumo?k=<chave>
    static var urlResumo: URL? {
        var c = URLComponents()
        c.scheme = "https"
        c.host = host
        c.path = "/oceanoResumo"
        c.queryItems = [URLQueryItem(name: "k", value: chave)]
        return c.url
    }

    /// A página web equivalente (botão "Abrir mini painel").
    static let urlMiniPainel = URL(string: "https://caiosoares1899.github.io/hering/minipainel.html")!
}
