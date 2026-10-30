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

    init() {
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
        } catch {
            erro = error.localizedDescription
        }
    }
}
