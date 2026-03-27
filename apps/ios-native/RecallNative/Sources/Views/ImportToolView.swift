import SwiftUI

struct ImportToolView: View {
  @EnvironmentObject private var appState: RecallAppState
  @Environment(\.dismiss) private var dismiss
  @State private var payload = ""

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: RecallSpace.lg) {
        RecallCardSurface {
          VStack(alignment: .leading, spacing: RecallSpace.md) {
            Text("Bulk JSON Import")
              .font(.recallTitle)
              .foregroundStyle(RecallPalette.textPrimary)

            Text("Paste Apple Books highlight export JSON as a fallback utility. This is secondary to the approval inbox flow.")
              .font(.recallBody)
              .foregroundStyle(RecallPalette.textSecondary)

            TextEditor(text: $payload)
              .frame(minHeight: 260)
              .padding(RecallSpace.sm)
              .background(RecallPalette.elevated, in: RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous))

            Button("Validate Import") {
              appState.importJSON(payload)
            }
            .buttonStyle(RecallPrimaryButtonStyle())

            if let summary = appState.importResultSummary {
              Text(summary)
                .font(.recallCaption)
                .foregroundStyle(RecallPalette.textSecondary)
            }
          }
        }
      }
      .padding(RecallSpace.lg)
    }
    .background(RecallPalette.background.ignoresSafeArea())
    .navigationTitle("Import")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button("Done") {
          dismiss()
        }
      }
    }
  }
}
