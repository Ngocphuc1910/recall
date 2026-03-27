import SwiftUI

@main
struct RecallNativeApp: App {
  @StateObject private var appState = RecallAppState()

  var body: some Scene {
    WindowGroup {
      RecallRootView()
        .environmentObject(appState)
    }
  }
}
