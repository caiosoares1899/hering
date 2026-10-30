import SwiftUI

@main
struct OceanoBarApp: App {
    @StateObject private var modelo = Modelo()

    var body: some Scene {
        // O "rótulo" da barra de menu é só texto (emoji + nº de atrasados): emoji colorido não vira ícone cinza do sistema.
        MenuBarExtra {
            MenuView(modelo: modelo)
        } label: {
            Text(modelo.rotuloBarra)
        }
        .menuBarExtraStyle(.window)
    }
}
