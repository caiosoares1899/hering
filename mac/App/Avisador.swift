import AppKit
import UserNotifications

/// Manda a notificação do macOS e abre o mini painel quando a pessoa clica nela.
/// Sem isto, o app (que vive na barra de menu) não mostra o banner enquanto o painel dele está aberto.
final class Avisador: NSObject, UNUserNotificationCenterDelegate {
    func preparar() {
        let centro = UNUserNotificationCenter.current()
        centro.delegate = self
        centro.requestAuthorization(options: [.alert, .sound]) { _, _ in }   // o macOS pergunta uma única vez
    }

    func enviar(titulo: String, corpo: String) {
        let conteudo = UNMutableNotificationContent()
        conteudo.title = titulo
        conteudo.body = corpo
        conteudo.sound = .default
        let pedido = UNNotificationRequest(identifier: UUID().uuidString, content: conteudo, trigger: nil)
        UNUserNotificationCenter.current().add(pedido) { _ in }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        DispatchQueue.main.async { NSWorkspace.shared.open(Config.urlMiniPainel) }
        completionHandler()
    }
}
