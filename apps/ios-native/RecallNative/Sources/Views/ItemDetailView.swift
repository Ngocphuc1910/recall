import SwiftUI

struct ItemDetailView: View {
  @EnvironmentObject private var appState: RecallAppState
  let itemID: String
  @State private var showArchiveDialog = false

  private var item: RecallItem? {
    appState.items.first(where: { $0.id == itemID })
  }

  var body: some View {
    ScrollView {
      if let item {
        VStack(alignment: .leading, spacing: RecallSpace.lg) {
          HStack(spacing: RecallSpace.sm) {
            CategoryBadgeView(category: appState.categories.first(where: { $0.id == item.categoryId }))
            PriorityBadgeView(priority: item.priority)
          }

          Text(item.content)
            .font(.system(size: 30, weight: .semibold))
            .foregroundStyle(RecallPalette.textPrimary)

          if !item.source.isEmpty {
            Text(item.source)
              .font(.recallHeadline)
              .foregroundStyle(RecallPalette.textSecondary)
          }

          if !item.detail.isEmpty {
            RecallCardSurface {
              Text(item.detail)
                .font(.recallBody)
                .foregroundStyle(RecallPalette.textPrimary)
            }
          }

          RecallCardSurface {
            VStack(alignment: .leading, spacing: RecallSpace.md) {
              RecallSectionHeader(title: "PRIORITY")
              LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
                ForEach(Priority.allCases) { priority in
                  Button {
                    Task { await appState.updatePriority(for: item, priority: priority) }
                  } label: {
                    PrioritySelectionCard(priority: priority, isSelected: item.priority == priority)
                  }
                  .buttonStyle(.plain)
                }
              }
            }
          }

          LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
            stat(title: "Next Review", value: item.nextReviewDate.formatted(date: .abbreviated, time: .omitted))
            stat(title: "Current Interval", value: "\(item.currentInterval) days")
            stat(title: "Times Reviewed", value: "\(item.reviewCount)")
            stat(title: "Added", value: item.createdAt.formatted(date: .abbreviated, time: .omitted))
          }

          HStack(spacing: RecallSpace.sm) {
            Button("Forgot") {
              Task { await appState.mark(item: item, recalled: false) }
            }
            .buttonStyle(RecallSecondaryButtonStyle(tint: RecallPalette.warning))

            Button("I Recall") {
              Task { await appState.mark(item: item, recalled: true) }
            }
            .buttonStyle(RecallPrimaryButtonStyle())
          }

          Button("Archive Item", role: .destructive) {
            showArchiveDialog = true
          }
        }
        .padding(RecallSpace.lg)
      } else {
        EmptyStateView(
          icon: "questionmark.circle",
          title: "Item not found",
          subtitle: "This recall item is missing from the current store."
        )
        .padding(RecallSpace.lg)
      }
    }
    .background(RecallPalette.background.ignoresSafeArea())
    .navigationTitle("Item Detail")
    .navigationBarTitleDisplayMode(.inline)
    .confirmationDialog("Archive this item?", isPresented: $showArchiveDialog) {
      if let item {
        Button("Archive", role: .destructive) {
          Task { await appState.archive(item: item) }
        }
      }
      Button("Cancel", role: .cancel) {}
    }
  }

  @ViewBuilder
  private func stat(title: String, value: String) -> some View {
    VStack(alignment: .leading, spacing: RecallSpace.xs) {
      Text(title)
        .font(.recallMeta)
        .foregroundStyle(RecallPalette.textTertiary)
      Text(value)
        .font(.recallHeadline)
        .foregroundStyle(RecallPalette.textPrimary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(RecallSpace.md)
    .background(RecallPalette.accentSoft.opacity(0.45), in: RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous))
  }
}
