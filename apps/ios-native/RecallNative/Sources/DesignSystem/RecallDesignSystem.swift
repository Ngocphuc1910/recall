import SwiftUI
import UIKit

enum RecallSpace {
  static let xxs: CGFloat = 4
  static let xs: CGFloat = 8
  static let sm: CGFloat = 12
  static let md: CGFloat = 16
  static let lg: CGFloat = 24
  static let xl: CGFloat = 32
}

enum RecallRadius {
  static let sm: CGFloat = 12
  static let md: CGFloat = 18
  static let lg: CGFloat = 28
}

enum RecallPalette {
  static let background = Color(hex: "#F4F5F1")
  static let surface = Color.white
  static let elevated = Color(hex: "#FCFCF9")
  static let textPrimary = Color(hex: "#131517")
  static let textSecondary = Color(hex: "#5D6470")
  static let textTertiary = Color(hex: "#868E9B")
  static let border = Color(hex: "#D9DDD6")
  static let success = Color(hex: "#0E9F6E")
  static let warning = Color(hex: "#D97706")
  static let destructive = Color(hex: "#D92D20")
  static let accent = Color(hex: "#0F6FFF")
  static let accentSoft = Color(hex: "#E9F1FF")
}

extension Font {
  static let recallLargeTitle = Font.system(size: 34, weight: .bold, design: .default)
  static let recallTitle = Font.system(size: 28, weight: .bold, design: .default)
  static let recallHeadline = Font.system(size: 17, weight: .semibold, design: .default)
  static let recallBody = Font.system(size: 16, weight: .regular, design: .default)
  static let recallCaption = Font.system(size: 13, weight: .medium, design: .default)
  static let recallMeta = Font.system(size: 12, weight: .semibold, design: .default)
}

struct RecallCardSurface<Content: View>: View {
  @ViewBuilder var content: Content

  var body: some View {
    content
      .padding(RecallSpace.md)
      .background(
        RoundedRectangle(cornerRadius: RecallRadius.md, style: .continuous)
          .fill(RecallPalette.surface)
      )
      .overlay(
        RoundedRectangle(cornerRadius: RecallRadius.md, style: .continuous)
          .stroke(RecallPalette.border.opacity(0.8), lineWidth: 1)
      )
      .shadow(color: .black.opacity(0.04), radius: 16, x: 0, y: 10)
  }
}

struct RecallPrimaryButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.recallHeadline)
      .foregroundStyle(.white)
      .frame(maxWidth: .infinity)
      .padding(.vertical, 14)
      .background(
        RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous)
          .fill(RecallPalette.accent)
          .opacity(configuration.isPressed ? 0.9 : 1)
      )
      .scaleEffect(configuration.isPressed ? 0.99 : 1)
  }
}

struct RecallSecondaryButtonStyle: ButtonStyle {
  var tint: Color = RecallPalette.textPrimary

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.recallHeadline)
      .foregroundStyle(tint)
      .frame(maxWidth: .infinity)
      .padding(.vertical, 14)
      .background(
        RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous)
          .fill(RecallPalette.elevated)
      )
      .overlay(
        RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous)
          .stroke(tint.opacity(0.14), lineWidth: 1)
      )
      .opacity(configuration.isPressed ? 0.92 : 1)
  }
}

struct RecallSectionHeader: View {
  let title: String
  var trailing: String?

  var body: some View {
    HStack {
      Text(title)
        .font(.recallMeta)
        .foregroundStyle(RecallPalette.textSecondary)
        .tracking(0.8)
      Spacer()
      if let trailing {
        Text(trailing)
          .font(.recallMeta)
          .foregroundStyle(RecallPalette.textTertiary)
      }
    }
  }
}

struct EmptyStateView: View {
  let icon: String
  let title: String
  let subtitle: String

  var body: some View {
    VStack(spacing: RecallSpace.sm) {
      Image(systemName: icon)
        .font(.system(size: 28, weight: .semibold))
        .foregroundStyle(RecallPalette.accent)
        .frame(width: 72, height: 72)
        .background(RecallPalette.accentSoft, in: RoundedRectangle(cornerRadius: 24, style: .continuous))

      Text(title)
        .font(.recallTitle)
        .foregroundStyle(RecallPalette.textPrimary)

      Text(subtitle)
        .font(.recallBody)
        .foregroundStyle(RecallPalette.textSecondary)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, RecallSpace.xl)
  }
}

struct CategoryBadgeView: View {
  let category: Category?

  var body: some View {
    HStack(spacing: RecallSpace.xs) {
      Image(systemName: category?.icon ?? "sparkles")
        .font(.system(size: 11, weight: .semibold))
      Text(category?.name ?? "Other")
        .font(.recallCaption)
    }
    .foregroundStyle(category?.color ?? RecallPalette.accent)
    .padding(.horizontal, 10)
    .padding(.vertical, 6)
    .background((category?.color ?? RecallPalette.accent).opacity(0.12), in: Capsule())
  }
}

struct PriorityBadgeView: View {
  let priority: Priority

  var body: some View {
    HStack(spacing: RecallSpace.xs) {
      Circle()
        .fill(priority.color)
        .frame(width: 8, height: 8)
      Text(priority.label)
        .font(.recallCaption)
    }
    .foregroundStyle(priority.color)
    .padding(.horizontal, 10)
    .padding(.vertical, 6)
    .background(priority.color.opacity(0.12), in: Capsule())
  }
}

struct FilterChip: View {
  let title: String
  let isSelected: Bool
  let tint: Color

  var body: some View {
    Text(title)
      .font(.recallCaption)
      .foregroundStyle(isSelected ? .white : RecallPalette.textPrimary)
      .padding(.horizontal, 14)
      .padding(.vertical, 10)
      .background(
        Capsule(style: .continuous)
          .fill(isSelected ? tint : RecallPalette.surface)
      )
      .overlay(
        Capsule(style: .continuous)
          .stroke(isSelected ? tint : RecallPalette.border, lineWidth: 1)
      )
  }
}

struct HeroRecallCard: View {
  let item: RecallItem
  let category: Category?
  let onRecall: () -> Void
  let onForgot: () -> Void

  var body: some View {
    RecallCardSurface {
      VStack(alignment: .leading, spacing: RecallSpace.md) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: RecallSpace.xs) {
            HStack(spacing: RecallSpace.xs) {
              CategoryBadgeView(category: category)
              PriorityBadgeView(priority: item.priority)
            }

            Text("Day \(item.currentInterval)")
              .font(.recallCaption)
              .foregroundStyle(RecallPalette.textTertiary)
          }

          Spacer()
        }

        Text(item.content)
          .font(.system(size: 28, weight: .semibold, design: .default))
          .foregroundStyle(RecallPalette.textPrimary)
          .lineSpacing(2)

        if !item.source.isEmpty || !item.detail.isEmpty {
          VStack(alignment: .leading, spacing: RecallSpace.xs) {
            if !item.source.isEmpty {
              Text(item.source)
                .font(.recallHeadline)
                .foregroundStyle(RecallPalette.textSecondary)
            }
            if !item.detail.isEmpty {
              Text(item.detail)
                .font(.recallBody)
                .foregroundStyle(RecallPalette.textSecondary)
            }
          }
        }

        HStack(spacing: RecallSpace.sm) {
          Button(action: onForgot) {
            Label("Forgot", systemImage: "arrow.counterclockwise")
          }
          .buttonStyle(RecallSecondaryButtonStyle(tint: RecallPalette.warning))

          Button(action: onRecall) {
            Label("I Recall", systemImage: "checkmark.circle.fill")
          }
          .buttonStyle(RecallPrimaryButtonStyle())
        }
      }
    }
  }
}

struct InlineErrorBanner: View {
  let message: String

  var body: some View {
    HStack(spacing: RecallSpace.sm) {
      Image(systemName: "exclamationmark.triangle.fill")
      Text(message)
        .font(.recallCaption)
    }
    .foregroundStyle(RecallPalette.destructive)
    .padding(.horizontal, RecallSpace.md)
    .padding(.vertical, RecallSpace.sm)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RecallPalette.destructive.opacity(0.1), in: RoundedRectangle(cornerRadius: RecallRadius.sm, style: .continuous))
  }
}

enum Haptics {
  static func success() {
    UINotificationFeedbackGenerator().notificationOccurred(.success)
  }

  static func warning() {
    UINotificationFeedbackGenerator().notificationOccurred(.warning)
  }

  static func error() {
    UINotificationFeedbackGenerator().notificationOccurred(.error)
  }
}

extension Color {
  init(hex: String) {
    let hex = hex.replacingOccurrences(of: "#", with: "")
    var int: UInt64 = 0
    Scanner(string: hex).scanHexInt64(&int)
    let r, g, b: UInt64
    switch hex.count {
    case 6:
      (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
    default:
      (r, g, b) = (0, 0, 0)
    }
    self.init(
      .sRGB,
      red: Double(r) / 255,
      green: Double(g) / 255,
      blue: Double(b) / 255,
      opacity: 1
    )
  }
}
