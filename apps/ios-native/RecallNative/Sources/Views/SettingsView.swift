import SwiftUI

struct SettingsView: View {
  @EnvironmentObject private var appState: RecallAppState
  @State private var showingImport = false

  var body: some View {
    List {
      Section("Cloud") {
        LabeledContent("User ID", value: appState.userID ?? (appState.isPreviewMode ? "Preview mode" : "Connecting"))
        LabeledContent("Sync", value: String(describing: appState.cloudSyncStatus).capitalized)
        if let error = appState.cloudError {
          Text(error)
            .font(.recallCaption)
            .foregroundStyle(RecallPalette.destructive)
        }
      }

      Section("Statistics") {
        LabeledContent("Active Items", value: "\(appState.items.filter { $0.status == .active }.count)")
        LabeledContent("Staged Highlights", value: "\(appState.stagedHighlights.count)")
        LabeledContent("Sync Requests", value: "\(appState.syncRequests.count)")
      }

      Section("Tools") {
        Button("Open JSON Import") {
          showingImport = true
        }
      }
    }
    .scrollContentBackground(.hidden)
    .background(RecallPalette.background.ignoresSafeArea())
    .navigationTitle("Settings")
    .navigationBarTitleDisplayMode(.large)
    .sheet(isPresented: $showingImport) {
      NavigationStack {
        ImportToolView()
      }
      .environmentObject(appState)
    }
  }
}
