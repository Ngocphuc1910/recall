import SwiftUI

struct LibraryView: View {
  @EnvironmentObject private var appState: RecallAppState
  @State private var search = ""
  @State private var selectedCategory: String?

  private var filteredItems: [RecallItem] {
    appState.items
      .filter { $0.status == .active }
      .filter { item in
        guard let selectedCategory else { return true }
        return item.categoryId == selectedCategory
      }
      .filter { item in
        guard !search.isEmpty else { return true }
        let query = search.lowercased()
        return item.content.lowercased().contains(query)
          || item.source.lowercased().contains(query)
          || item.detail.lowercased().contains(query)
      }
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: RecallSpace.lg) {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: RecallSpace.sm) {
            chip("All", isSelected: selectedCategory == nil) {
              selectedCategory = nil
            }
            ForEach(appState.categories) { category in
              chip(category.name, isSelected: selectedCategory == category.id) {
                selectedCategory = category.id
              }
            }
          }
        }

        if filteredItems.isEmpty {
          EmptyStateView(
            icon: "books.vertical",
            title: "Nothing here yet",
            subtitle: "Imported highlights and manually added recall items will appear here."
          )
        } else {
          VStack(spacing: RecallSpace.md) {
            ForEach(filteredItems) { item in
              NavigationLink {
                ItemDetailView(itemID: item.id)
              } label: {
                RecallCardSurface {
                  VStack(alignment: .leading, spacing: RecallSpace.sm) {
                    HStack {
                      CategoryBadgeView(category: appState.categories.first(where: { $0.id == item.categoryId }))
                      PriorityBadgeView(priority: item.priority)
                      Spacer()
                    }

                    Text(item.content)
                      .font(.recallHeadline)
                      .foregroundStyle(RecallPalette.textPrimary)
                      .multilineTextAlignment(.leading)

                    Text(item.source.isEmpty ? "Manual item" : item.source)
                      .font(.recallCaption)
                      .foregroundStyle(RecallPalette.textSecondary)
                  }
                }
              }
              .buttonStyle(.plain)
            }
          }
        }
      }
      .padding(RecallSpace.lg)
    }
    .searchable(text: $search, prompt: "Search content, source, or notes")
    .background(RecallPalette.background.ignoresSafeArea())
    .navigationTitle("Library")
    .navigationBarTitleDisplayMode(.large)
  }

  @ViewBuilder
  private func chip(_ title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      FilterChip(title: title, isSelected: isSelected, tint: RecallPalette.accent)
    }
    .buttonStyle(.plain)
  }
}
