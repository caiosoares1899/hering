import Foundation
import SwiftUI

/// Estado do app da barra de menu: consulta a função a cada minuto e guarda o último resumo bom
/// (se a rede cair, continua mostrando o último dado e avisa).
@MainActor
final class Modelo: ObservableObject {
    @Published var resumo: Resumo?
    @Published var erro: String?
    @Published var atualizando = false
    @Published var ultimaAtualizacao: Date?

    private var tarefa: Task<Void, Never>?
    private let avisador = Avisador()
    private var anterior: Aviso.Foto?   // leitura anterior (base pra saber se ALGO mudou)

    /// Interruptor do menu ("Avisar quando algo mudar"); ausente = ligado.
    var avisosLigados: Bool {
        get { UserDefaults.standard.object(forKey: "avisosLigados") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "avisosLigados"); objectWillChange.send() }
    }

    init() {
        avisador.preparar()
        tarefa = Task { [weak self] in
            while !Task.isCancelled {
                await self?.atualizar()
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
            }
        }
    }

    var rotuloBarra: String {
        if let r = resumo { return erro == nil ? r.rotuloBarra : "⚪️ " + r.rotuloBarra }
        return "⚪️"
    }

    func atualizar() async {
        if atualizando { return }
        atualizando = true
        defer { atualizando = false }
        do {
            resumo = try await Cliente.buscar()
            ultimaAtualizacao = Date()
            erro = nil
            avisarSeMudou()
        } catch {
            erro = error.localizedDescription
        }
    }

    /// "Testar o aviso" do menu: confirma que a permissão de notificação foi dada (o macOS pergunta na 1ª vez).
    func testarAviso() {
        avisador.enviar(titulo: "🟢 Oceano: teste do aviso", corpo: "Se você está lendo isto, os avisos funcionam neste Mac.")
    }

    /// Compara com a leitura anterior e manda a notificação do macOS quando o semáforo (ou a lista de problemas) mudou.
    private func avisarSeMudou() {
        guard let r = resumo else { return }
        let agora: Aviso.Foto = (estado: r.estadoGeral, problemas: r.problemas)
        defer { anterior = agora }
        guard let antes = anterior, avisosLigados, let a = Aviso.de(antes: antes, depois: agora) else { return }
        avisador.enviar(titulo: a.titulo, corpo: a.corpo)
    }
}
