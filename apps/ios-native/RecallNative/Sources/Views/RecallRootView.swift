import SwiftUI

struct RecallRootView: View {
  @EnvironmentObject private var appState: RecallAppState

  var body: some View {
    TabView(selection: $appState.selectedTab) {
      NavigationStack {
        TodayView()
      }
      .tabItem {
        Label("Today", systemImage: "sun.max")
      }
      .tag(RecallTab.today)

      NavigationStack {
        LibraryView()
      }
      .tabItem {
        Label("Library", systemImage: "square.grid.2x2")
      }
      .tag(RecallTab.library)

      NavigationStack {
        ApprovalView()
      }
      .tabItem {
        Label("Approval", systemImage: "tray.full")
      }
      .tag(RecallTab.approval)

      NavigationStack {
        SettingsView()
      }
      .tabItem {
        Label("Settings", systemImage: "gearshape")
      }
      .tag(RecallTab.settings)
    }
    .tint(RecallPalette.accent)
    .background(RecallPalette.background)
  }
}
