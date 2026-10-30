import Foundation

/// O JSON devolvido por `oceanoResumo` (functions/oceano/resumo.js → montarResumo).
/// Tudo é opcional de propósito: se a função ganhar ou perder um campo, o app continua abrindo.
/// O teste functions/oceano/__tests__/contrato_mac.test.js confere que todo nome daqui existe no JSON real.
struct Resumo: Decodable {
    let geral: String?
    let geradoEm: String?
    let dono: Dono?
    let status: Sistema?
    let backup: Peca?
    let plantao: Plantao?
    let alarmesSumico: Alarmes?
    let meusCards: MeusCards?

    struct Dono: Decodable {
        let iniciais: String?
        let squads: Int?
    }

    struct Sistema: Decodable {
        let vtex: Peca?
        let github: Peca?
        let firebase: Peca?
    }

    struct Peca: Decodable {
        let estado: String?
        let texto: String?
    }

    struct Plantao: Decodable {
        let abertos: Int?
        let aguardandoValidacao: Int?
        let escalados: Int?
    }

    struct Alarmes: Decodable {
        let ultimas24h: Int?
        let ultimoEm: String?
        let squadUltimo: String?
    }

    struct MeusCards: Decodable {
        let ativos: Int?
        let atrasados: Int?
        let venceHoje: Int?
        let bloqueados: Int?
        let semPrazo: Int?
        let venceEm7dias: Int?
        let hoje: String?
        let lista: [Card]?
    }

    struct Card: Decodable, Identifiable {
        let idCard: String?
        let squad: String?
        let titulo: String?
        let prazo: String?
        let atrasado: Bool?
        let diasAtraso: Int?
        let venceHoje: Bool?
        let bloqueado: Bool?
        let semPrazo: Bool?

        enum CodingKeys: String, CodingKey {
            case idCard = "id"
            case squad, titulo, prazo, atrasado, diasAtraso, venceHoje, bloqueado, semPrazo
        }

        var id: String { "\(squad ?? "")-\(idCard ?? titulo ?? "")" }
    }
}
