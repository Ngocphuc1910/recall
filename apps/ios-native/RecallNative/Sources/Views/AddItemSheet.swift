import SwiftUI

struct AddItemSheet: View {
  @EnvironmentObject private var appState: RecallAppState
  @Environment(\.dismiss) private var dismiss

  @State private var content = ""
  @State private var detail = ""
  @State private var source = ""
  @State private var categoryID = RecallDefaults.categories.first?.id ?? "other"
  @State private var priority = Priority.medium

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: RecallSpace.lg) {
          inputSection(title: "Content") {
            TextEditor(text: $content)
              .frame(minHeight: 120)
              .padding(RecallSpace.sm)
              .background(RecallPalette.elevated, in: RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous))
          }

          inputSection(title: "Notes") {
            TextEditor(text: $detail)
              .frame(minHeight: 100)
              .padding(RecallSpace.sm)
              .background(RecallPalette.elevated, in: RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous))
          }

          inputSection(title: "Source") {
            TextField("Book, article, course...", text: $source)
              .textFieldStyle(.plain)
              .padding(RecallSpace.md)
              .background(RecallPalette.elevated, in: RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous))
          }

          inputSection(title: "Category") {
            ScrollView(.horizontal, showsIndicators: false) {
              HStack(spacing: RecallSpace.sm) {
                ForEach(appState.categories) { category in
                  Button {
                    categoryID = category.id
                  } label: {
                    FilterChip(title: category.name, isSelected: categoryID == category.id, tint: category.color)
                  }
                  .buttonStyle(.plain)
                }
              }
            }
          }

          inputSection(title: "Priority") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
              ForEach(Priority.allCases) { option in
                Button {
                  priority = option
                } label: {
                  PrioritySelectionCard(priority: option, isSelected: option == priority)
                }
                .buttonStyle(.plain)
              }
            }
          }
        }
        .padding(RecallSpace.lg)
      }
      .background(RecallPalette.background.ignoresSafeArea())
      .navigationTitle("Add Item")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button("Cancel") {
            dismiss()
          }
        }

        ToolbarItem(placement: .topBarTrailing) {
          Button("Save") {
            Task {
              await appState.addItem(
                draft: AddItemDraft(
                  content: content,
                  detail: detail,
                  source: source,
                  categoryId: categoryID,
                  priority: priority
                )
              )
              dismiss()
            }
          }
          .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
      }
    }
  }

  @ViewBuilder
  private func inputSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: RecallSpace.sm) {
      Text(title.uppercased())
        .font(.recallMeta)
        .foregroundStyle(RecallPalette.textTertiary)
      content()
    }
  }
}
