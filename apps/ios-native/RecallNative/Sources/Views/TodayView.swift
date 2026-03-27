import SwiftUI

struct TodayView: View {
  @EnvironmentObject private var appState: RecallAppState
  @State private var showingAddSheet = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: RecallSpace.lg) {
        if let error = appState.cloudError {
          InlineErrorBanner(message: error)
        }

        if let item = appState.todayItems.first {
          HeroRecallCard(
            item: item,
            category: appState.categories.first(where: { $0.id == item.categoryId }),
            onRecall: { Task { await appState.mark(item: item, recalled: true) } },
            onForgot: { Task { await appState.mark(item: item, recalled: false) } }
          )
        } else {
          EmptyStateView(
            icon: "checkmark.circle",
            title: RecallCopy.emptyTodayTitle,
            subtitle: RecallCopy.emptyTodaySubtitle
          )
        }

        RecallSectionHeader(title: "QUEUE", trailing: "\(appState.todayItems.count)")

        VStack(spacing: RecallSpace.md) {
          ForEach(appState.todayItems) { item in
            NavigationLink {
              ItemDetailView(itemID: item.id)
            } label: {
              RecallCardSurface {
                VStack(alignment: .leading, spacing: RecallSpace.sm) {
                  HStack {
                    CategoryBadgeView(category: appState.categories.first(where: { $0.id == item.categoryId }))
                    PriorityBadgeView(priority: item.priority)
                    Spacer()
                    Text("Day \(item.currentInterval)")
                      .font(.recallCaption)
                      .foregroundStyle(RecallPalette.textTertiary)
                  }

                  Text(item.content)
                    .font(.recallHeadline)
                    .foregroundStyle(RecallPalette.textPrimary)
                    .multilineTextAlignment(.leading)

                  if !item.source.isEmpty {
                    Text(item.source)
                      .font(.recallCaption)
                      .foregroundStyle(RecallPalette.textSecondary)
                  }
                }
              }
            }
            .buttonStyle(.plain)
          }
        }
      }
      .padding(RecallSpace.lg)
    }
    .background(RecallPalette.background.ignoresSafeArea())
    .navigationTitle("Today")
    .navigationBarTitleDisplayMode(.large)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          showingAddSheet = true
        } label: {
          Image(systemName: "plus")
        }
      }
    }
    .sheet(isPresented: $showingAddSheet) {
      AddItemSheet()
        .environmentObject(appState)
    }
  }
}
