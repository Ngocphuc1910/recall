import SwiftUI

struct ApprovalView: View {
  @EnvironmentObject private var appState: RecallAppState

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: RecallSpace.lg) {
        RecallCardSurface {
          VStack(alignment: .leading, spacing: RecallSpace.md) {
            RecallSectionHeader(
              title: "APPLE BOOKS SYNC",
              trailing: appState.syncRequests.first?.status.rawValue.capitalized
            )

            Button("Sync Apple Books") {
              Task { await appState.requestAppleBooksSync() }
            }
            .buttonStyle(RecallPrimaryButtonStyle())

            if let summary = appState.syncRequests.first?.resultSummary {
              Text(summary)
                .font(.recallCaption)
                .foregroundStyle(RecallPalette.textSecondary)
            }
          }
        }

        if appState.pendingHighlights.isEmpty {
          EmptyStateView(
            icon: "tray",
            title: RecallCopy.approvalEmptyTitle,
            subtitle: RecallCopy.approvalEmptySubtitle
          )
        } else {
          HStack(spacing: RecallSpace.sm) {
            Button("Approve All Ready (\(readyHighlights.count))") {
              Task { await appState.approve(highlights: readyHighlights) }
            }
            .buttonStyle(RecallSecondaryButtonStyle(tint: RecallPalette.success))

            Button("Reject All") {
              Task { await appState.reject(highlights: appState.pendingHighlights) }
            }
            .buttonStyle(RecallSecondaryButtonStyle(tint: RecallPalette.destructive))
          }

          ForEach(appState.pendingHighlights) { highlight in
            RecallCardSurface {
              VStack(alignment: .leading, spacing: RecallSpace.md) {
                HStack {
                  PriorityBadgeView(priority: highlight.priority)
                  Spacer()
                  Text(highlight.highlightedAt?.formatted(date: .abbreviated, time: .omitted) ?? "Unknown date")
                    .font(.recallCaption)
                    .foregroundStyle(RecallPalette.textTertiary)
                }

                Text(highlight.content)
                  .font(.recallHeadline)
                  .foregroundStyle(RecallPalette.textPrimary)

                if !highlight.detail.isEmpty {
                  Text(highlight.detail)
                    .font(.recallBody)
                    .foregroundStyle(RecallPalette.textSecondary)
                }

                VStack(alignment: .leading, spacing: RecallSpace.sm) {
                  Text("Category")
                    .font(.recallMeta)
                    .foregroundStyle(RecallPalette.textTertiary)

                  ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: RecallSpace.sm) {
                      ForEach(appState.categories) { category in
                        Button {
                          Task { await appState.updateStagedCategory(id: highlight.id, categoryId: category.id) }
                        } label: {
                          FilterChip(
                            title: category.name,
                            isSelected: highlight.categoryId == category.id,
                            tint: category.color
                          )
                        }
                        .buttonStyle(.plain)
                      }
                    }
                  }
                }

                VStack(alignment: .leading, spacing: RecallSpace.sm) {
                  Text("Priority")
                    .font(.recallMeta)
                    .foregroundStyle(RecallPalette.textTertiary)

                  LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 10)], spacing: 10) {
                    ForEach(Priority.allCases) { priority in
                      Button {
                        Task { await appState.updateStagedPriority(id: highlight.id, priority: priority) }
                      } label: {
                        PrioritySelectionCard(priority: priority, isSelected: highlight.priority == priority)
                      }
                      .buttonStyle(.plain)
                    }
                  }
                }

                HStack(spacing: RecallSpace.sm) {
                  Button("Reject") {
                    Task { await appState.reject(highlights: [highlight]) }
                  }
                  .buttonStyle(RecallSecondaryButtonStyle(tint: RecallPalette.destructive))

                  Button("Approve") {
                    Task { await appState.approve(highlights: [highlight]) }
                  }
                  .buttonStyle(RecallPrimaryButtonStyle())
                  .disabled(highlight.categoryId == nil || highlight.categoryStatus != .chosen)
                }
              }
            }
          }
        }

        historySection(title: "Approved", highlights: appState.stagedHighlights.filter { $0.approvalStatus == .approved })
        historySection(title: "Rejected", highlights: appState.stagedHighlights.filter { $0.approvalStatus == .rejected })
      }
      .padding(RecallSpace.lg)
    }
    .background(RecallPalette.background.ignoresSafeArea())
    .navigationTitle("Approval")
    .navigationBarTitleDisplayMode(.large)
  }

  private var readyHighlights: [StagedHighlight] {
    appState.pendingHighlights.filter { $0.categoryStatus == .chosen && $0.categoryId != nil }
  }

  @ViewBuilder
  private func historySection(title: String, highlights: [StagedHighlight]) -> some View {
    RecallSectionHeader(title: title.uppercased(), trailing: "\(highlights.count)")
    if highlights.isEmpty {
      Text("No \(title.lowercased()) highlights yet.")
        .font(.recallCaption)
        .foregroundStyle(RecallPalette.textSecondary)
    } else {
      VStack(spacing: RecallSpace.md) {
        ForEach(highlights.prefix(5)) { highlight in
          RecallCardSurface {
            VStack(alignment: .leading, spacing: RecallSpace.sm) {
              HStack {
                Text(highlight.source)
                  .font(.recallHeadline)
                  .foregroundStyle(RecallPalette.textPrimary)
                Spacer()
                PriorityBadgeView(priority: highlight.priority)
              }
              Text(highlight.content)
                .font(.recallBody)
                .foregroundStyle(RecallPalette.textSecondary)
            }
          }
        }
      }
    }
  }
}

private struct PrioritySelectionCard: View {
  let priority: Priority
  let isSelected: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: RecallSpace.xs) {
      PriorityBadgeView(priority: priority)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(RecallSpace.md)
    .background(
      RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous)
        .fill(RecallPalette.surface)
    )
    .overlay(
      RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous)
        .stroke(isSelected ? priority.color : RecallPalette.border, lineWidth: 1)
    )
  }
}
