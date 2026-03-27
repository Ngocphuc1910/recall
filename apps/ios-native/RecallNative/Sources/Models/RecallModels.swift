import Foundation
import SwiftUI

enum RecallTab: Hashable {
  case today
  case library
  case approval
  case settings
}

enum CloudAuthStatus: Equatable {
  case idle
  case connecting
  case connected
  case error
}

enum CloudSyncStatus: Equatable {
  case local
  case syncing
  case synced
  case error
}

enum RecallStatus: String, Codable, CaseIterable {
  case active
  case archived
}

enum ApprovalStatus: String, Codable, CaseIterable {
  case pending
  case approved
  case rejected
}

enum ImportStatus: String, Codable, CaseIterable {
  case staged
  case imported
  case skippedDuplicate = "skipped_duplicate"
}

enum CategoryStatus: String, Codable, CaseIterable {
  case unset
  case chosen
}

enum SyncRequestStatus: String, Codable, CaseIterable {
  case pending
  case running
  case completed
  case failed
}

enum SyncSource: String, Codable, CaseIterable {
  case appleBooks = "apple_books"
}

enum ThemePreference: String, Codable, CaseIterable {
  case light
  case dark
  case system
}

enum Priority: Int, Codable, CaseIterable, Identifiable {
  case high = 1
  case medium = 2
  case low = 3
  case critical = 4
  case mindFuck = 5

  var id: Int { rawValue }

  var label: String {
    switch self {
    case .high: return "High"
    case .medium: return "Medium"
    case .low: return "Low"
    case .critical: return "Critical"
    case .mindFuck: return "MindFuck"
    }
  }

  var color: Color {
    switch self {
    case .high: return Color(hex: "#FF9F0A")
    case .medium: return Color(hex: "#007AFF")
    case .low: return Color(hex: "#34C759")
    case .critical: return Color(hex: "#FF3B30")
    case .mindFuck: return Color(hex: "#DB2777")
    }
  }

  static func from(style: Int?) -> Priority {
    guard let style, let priority = Priority(rawValue: style) else {
      return .medium
    }
    return priority
  }
}

struct Category: Identifiable, Codable, Hashable {
  let id: String
  let name: String
  let icon: String
  let colorHex: String
  let order: Int

  var color: Color {
    Color(hex: colorHex)
  }
}

struct AppSettings: Codable, Equatable {
  var defaultIntervals: [Int]
  var dailyGoal: Int
  var theme: ThemePreference
}

struct RecallItem: Identifiable, Hashable {
  let id: String
  var content: String
  var detail: String
  var categoryId: String
  var source: String
  var priority: Priority
  var externalId: String?
  var sourceAssetId: String?
  var sourceProvider: String?
  var locationCfi: String?
  var highlightedAt: Date?
  var highlightStyle: Int?
  var createdAt: Date
  var nextReviewDate: Date
  var currentInterval: Int
  var intervalIndex: Int
  var intervals: [Int]
  var reviewCount: Int
  var lastReviewedAt: Date?
  var status: RecallStatus

  var isDueToday: Bool {
    Calendar.current.startOfDay(for: nextReviewDate) <= Calendar.current.startOfDay(for: Date()) && status == .active
  }

  var priorityLabel: String {
    priority.label
  }
}

struct StagedHighlight: Identifiable, Hashable {
  let id: String
  var content: String
  var detail: String
  var categoryId: String?
  var categoryStatus: CategoryStatus
  var source: String
  var priority: Priority
  var dedupeKey: String
  var approvalStatus: ApprovalStatus
  var importStatus: ImportStatus
  var sourceProvider: String?
  var externalId: String?
  var sourceAssetId: String?
  var locationCfi: String?
  var highlightedAt: Date?
  var highlightStyle: Int?
  var raw: [String: String]
  var syncedAt: Date
  var createdAt: Date
  var updatedAt: Date
  var approvedAt: Date?
  var rejectedAt: Date?
}

struct SyncRequest: Identifiable, Hashable {
  let id: String
  let source: SyncSource
  var status: SyncRequestStatus
  var requestedAt: Date
  var startedAt: Date?
  var completedAt: Date?
  var lastSeenAt: Date?
  var resultSummary: String?
  var error: String?
}

struct MetaState: Codable {
  var categories: [CategoryDTO]
  var settings: SettingsDTO
}

struct RecallItemDTO: Codable {
  var id: String?
  var content: String
  var detail: String
  var categoryId: String
  var source: String
  var priorityCode: Int
  var priorityLabel: String
  var externalId: String?
  var sourceAssetId: String?
  var sourceProvider: String?
  var locationCfi: String?
  var highlightedAt: String?
  var highlightStyle: Int?
  var createdAt: Double
  var nextReviewDate: Double
  var currentInterval: Int
  var intervalIndex: Int
  var intervals: [Int]
  var reviewCount: Int
  var lastReviewedAt: Double?
  var status: String
}

struct StagedHighlightDTO: Codable {
  var id: String?
  var content: String
  var detail: String
  var categoryId: String?
  var categoryStatus: String
  var source: String
  var priorityCode: Int
  var priorityLabel: String
  var dedupeKey: String
  var approvalStatus: String
  var importStatus: String
  var sourceProvider: String?
  var externalId: String?
  var sourceAssetId: String?
  var locationCfi: String?
  var highlightedAt: String?
  var highlightStyle: Int?
  var raw: [String: String]?
  var syncedAt: Double
  var createdAt: Double
  var updatedAt: Double
  var approvedAt: Double?
  var rejectedAt: Double?
}

struct SyncRequestDTO: Codable {
  var id: String?
  var source: String
  var status: String
  var requestedAt: Double
  var startedAt: Double?
  var completedAt: Double?
  var lastSeenAt: Double?
  var resultSummary: String?
  var error: String?
}

struct CategoryDTO: Codable {
  var id: String
  var name: String
  var icon: String
  var color: String
  var order: Int
}

struct SettingsDTO: Codable {
  var defaultIntervals: [Int]
  var dailyGoal: Int
  var theme: String
}

struct AddItemDraft {
  var content: String = ""
  var detail: String = ""
  var source: String = ""
  var categoryId: String = "other"
  var priority: Priority = .medium
}

struct ImportPayload: Decodable {
  let version: Int
  let source: ImportPayloadSource?
  let items: [ImportPayloadItem]
}

struct ImportPayloadSource: Decodable {
  let provider: String?
  let bookTitle: String?
  let assetId: String?
}

struct ImportPayloadItem: Decodable {
  let externalId: String?
  let content: String?
  let detail: String?
  let source: String?
  let categoryId: String?
  let intervals: [Int]?
  let meta: ImportPayloadMeta?
}

struct ImportPayloadMeta: Decodable {
  let locationCfi: String?
  let highlightedAt: String?
  let style: Int?
}

struct ImportSummary {
  let total: Int
  let valid: Int
  let imported: Int
  let skippedDuplicates: Int
  let skippedInvalid: Int
  let warnings: [String]
  let errors: [String]
}

enum RecallCopy {
  static let emptyTodayTitle = "All caught up"
  static let emptyTodaySubtitle = "No items are due right now. Add something worth remembering or wait for the next review."
  static let approvalEmptyTitle = "Nothing waiting"
  static let approvalEmptySubtitle = "Request an Apple Books sync, then approve the incoming highlights here."
}

enum RecallDefaults {
  static let intervals = [1, 2, 3, 7, 14, 30, 60, 120, 240]

  static let categories: [Category] = [
    .init(id: "books", name: "Books", icon: "book.closed", colorHex: "#007AFF", order: 0),
    .init(id: "vocabulary", name: "Vocabulary", icon: "textformat.abc", colorHex: "#5856D6", order: 1),
    .init(id: "quotes", name: "Quotes", icon: "quote.bubble", colorHex: "#FF9500", order: 2),
    .init(id: "concepts", name: "Concepts", icon: "lightbulb", colorHex: "#34C759", order: 3),
    .init(id: "other", name: "Other", icon: "sparkles", colorHex: "#FF2D55", order: 4),
  ]

  static let settings = AppSettings(defaultIntervals: intervals, dailyGoal: 20, theme: .system)
}

enum RecallPreviewData {
  static let categories = RecallDefaults.categories
  static let settings = RecallDefaults.settings

  static let items: [RecallItem] = [
    RecallItem(
      id: "item-1",
      content: "Clarity about what matters provides clarity about what does not.",
      detail: "This belongs on the Today screen as a focused hero card.",
      categoryId: "quotes",
      source: "Deep Work",
      priority: .critical,
      externalId: nil,
      sourceAssetId: nil,
      sourceProvider: "apple_books",
      locationCfi: nil,
      highlightedAt: ISO8601DateFormatter().date(from: "2026-02-25T08:15:00Z"),
      highlightStyle: 4,
      createdAt: ISO8601DateFormatter().date(from: "2026-02-25T08:15:00Z") ?? Date(),
      nextReviewDate: Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date(),
      currentInterval: 3,
      intervalIndex: 2,
      intervals: RecallDefaults.intervals,
      reviewCount: 4,
      lastReviewedAt: Calendar.current.date(byAdding: .day, value: -2, to: Date()),
      status: .active
    ),
    RecallItem(
      id: "item-2",
      content: "A native redesign should feel quieter, sharper, and more deliberate than the current UI.",
      detail: "",
      categoryId: "concepts",
      source: "Product Notes",
      priority: .high,
      externalId: nil,
      sourceAssetId: nil,
      sourceProvider: nil,
      locationCfi: nil,
      highlightedAt: nil,
      highlightStyle: nil,
      createdAt: Calendar.current.date(byAdding: .day, value: -5, to: Date()) ?? Date(),
      nextReviewDate: Calendar.current.date(byAdding: .day, value: 2, to: Date()) ?? Date(),
      currentInterval: 7,
      intervalIndex: 3,
      intervals: RecallDefaults.intervals,
      reviewCount: 6,
      lastReviewedAt: Calendar.current.date(byAdding: .day, value: -1, to: Date()),
      status: .active
    ),
  ]

  static let stagedHighlights: [StagedHighlight] = [
    StagedHighlight(
      id: "staged-1",
      content: "You have to be willing to produce garbage in order to eventually produce something good.",
      detail: "",
      categoryId: "books",
      categoryStatus: .chosen,
      source: "The Paul Graham Book",
      priority: .critical,
      dedupeKey: "external:pg-1",
      approvalStatus: .pending,
      importStatus: .staged,
      sourceProvider: "apple_books",
      externalId: "pg-1",
      sourceAssetId: "asset-1",
      locationCfi: "epubcfi(/6/294/18)",
      highlightedAt: ISO8601DateFormatter().date(from: "2026-02-06T17:22:11Z"),
      highlightStyle: 4,
      raw: ["bookTitle": "The Paul Graham Book"],
      syncedAt: Date(),
      createdAt: ISO8601DateFormatter().date(from: "2026-02-06T17:22:11Z") ?? Date(),
      updatedAt: Date(),
      approvedAt: nil,
      rejectedAt: nil
    )
  ]

  static let syncRequests: [SyncRequest] = [
    SyncRequest(
      id: "sync-1",
      source: .appleBooks,
      status: .completed,
      requestedAt: Calendar.current.date(byAdding: .minute, value: -8, to: Date()) ?? Date(),
      startedAt: Calendar.current.date(byAdding: .minute, value: -7, to: Date()),
      completedAt: Calendar.current.date(byAdding: .minute, value: -6, to: Date()),
      lastSeenAt: Calendar.current.date(byAdding: .minute, value: -6, to: Date()),
      resultSummary: "Imported 3 new highlights, skipped 1 duplicate.",
      error: nil
    )
  ]
}

extension RecallItemDTO {
  func toDomain(id documentID: String) -> RecallItem {
    RecallItem(
      id: id ?? documentID,
      content: content,
      detail: detail,
      categoryId: categoryId,
      source: source,
      priority: Priority(rawValue: priorityCode) ?? .from(style: highlightStyle),
      externalId: externalId,
      sourceAssetId: sourceAssetId,
      sourceProvider: sourceProvider,
      locationCfi: locationCfi,
      highlightedAt: highlightedAt.flatMap { ISO8601DateFormatter().date(from: $0) },
      highlightStyle: highlightStyle,
      createdAt: Date(milliseconds: createdAt),
      nextReviewDate: Date(milliseconds: nextReviewDate),
      currentInterval: currentInterval,
      intervalIndex: intervalIndex,
      intervals: intervals,
      reviewCount: reviewCount,
      lastReviewedAt: lastReviewedAt.map(Date.init(milliseconds:)),
      status: RecallStatus(rawValue: status) ?? .active
    )
  }
}

extension RecallItem {
  func toDTO() -> RecallItemDTO {
    RecallItemDTO(
      id: id,
      content: content,
      detail: detail,
      categoryId: categoryId,
      source: source,
      priorityCode: priority.rawValue,
      priorityLabel: priority.label,
      externalId: externalId,
      sourceAssetId: sourceAssetId,
      sourceProvider: sourceProvider,
      locationCfi: locationCfi,
      highlightedAt: highlightedAt?.iso8601String,
      highlightStyle: highlightStyle,
      createdAt: createdAt.milliseconds,
      nextReviewDate: nextReviewDate.milliseconds,
      currentInterval: currentInterval,
      intervalIndex: intervalIndex,
      intervals: intervals,
      reviewCount: reviewCount,
      lastReviewedAt: lastReviewedAt?.milliseconds,
      status: status.rawValue
    )
  }
}

extension StagedHighlightDTO {
  func toDomain(id documentID: String) -> StagedHighlight {
    StagedHighlight(
      id: id ?? documentID,
      content: content,
      detail: detail,
      categoryId: categoryId,
      categoryStatus: CategoryStatus(rawValue: categoryStatus) ?? .unset,
      source: source,
      priority: Priority(rawValue: priorityCode) ?? .from(style: highlightStyle),
      dedupeKey: dedupeKey,
      approvalStatus: ApprovalStatus(rawValue: approvalStatus) ?? .pending,
      importStatus: ImportStatus(rawValue: importStatus) ?? .staged,
      sourceProvider: sourceProvider,
      externalId: externalId,
      sourceAssetId: sourceAssetId,
      locationCfi: locationCfi,
      highlightedAt: highlightedAt.flatMap { ISO8601DateFormatter().date(from: $0) },
      highlightStyle: highlightStyle,
      raw: raw ?? [:],
      syncedAt: Date(milliseconds: syncedAt),
      createdAt: Date(milliseconds: createdAt),
      updatedAt: Date(milliseconds: updatedAt),
      approvedAt: approvedAt.map(Date.init(milliseconds:)),
      rejectedAt: rejectedAt.map(Date.init(milliseconds:))
    )
  }
}

extension SyncRequestDTO {
  func toDomain(id documentID: String) -> SyncRequest {
    SyncRequest(
      id: id ?? documentID,
      source: SyncSource(rawValue: source) ?? .appleBooks,
      status: SyncRequestStatus(rawValue: status) ?? .pending,
      requestedAt: Date(milliseconds: requestedAt),
      startedAt: startedAt.map(Date.init(milliseconds:)),
      completedAt: completedAt.map(Date.init(milliseconds:)),
      lastSeenAt: lastSeenAt.map(Date.init(milliseconds:)),
      resultSummary: resultSummary,
      error: error
    )
  }
}

extension CategoryDTO {
  func toDomain() -> Category {
    Category(id: id, name: name, icon: icon, colorHex: color, order: order)
  }
}

extension Category {
  func toDTO() -> CategoryDTO {
    CategoryDTO(id: id, name: name, icon: icon, color: colorHex, order: order)
  }
}

extension SettingsDTO {
  func toDomain() -> AppSettings {
    AppSettings(
      defaultIntervals: defaultIntervals,
      dailyGoal: dailyGoal,
      theme: ThemePreference(rawValue: theme) ?? .system
    )
  }
}

extension AppSettings {
  func toDTO() -> SettingsDTO {
    SettingsDTO(defaultIntervals: defaultIntervals, dailyGoal: dailyGoal, theme: theme.rawValue)
  }
}

extension Date {
  init(milliseconds: Double) {
    self = Date(timeIntervalSince1970: milliseconds / 1000)
  }

  var milliseconds: Double {
    timeIntervalSince1970 * 1000
  }

  var iso8601String: String {
    ISO8601DateFormatter().string(from: self)
  }
}

extension Collection where Element == Category {
  func resolveCategoryID(_ candidate: String?) -> String {
    if let candidate, contains(where: { $0.id == candidate }) {
      return candidate
    }

    if let books = first(where: { $0.id == "books" }) {
      return books.id
    }

    if let quotes = first(where: { $0.id == "quotes" }) {
      return quotes.id
    }

    if let other = first(where: { $0.id == "other" }) {
      return other.id
    }

    return first?.id ?? "other"
  }
}

func buildImportDedupKey(
  externalId: String?,
  sourceAssetId: String?,
  content: String,
  source: String,
  locationCfi: String?
) -> String {
  let normalizedExternalId = normalizeKeyPart(externalId)
  let normalizedSourceAssetId = normalizeKeyPart(sourceAssetId)

  if !normalizedExternalId.isEmpty, !normalizedSourceAssetId.isEmpty {
    return "external_asset:\(normalizedExternalId)::\(normalizedSourceAssetId)"
  }

  if !normalizedExternalId.isEmpty {
    return "external:\(normalizedExternalId)"
  }

  return "content:\(normalizeKeyPart(content))::source:\(normalizeKeyPart(source))::cfi:\(normalizeKeyPart(locationCfi))"
}

func createNewItem(
  draft: AddItemDraft,
  settings: AppSettings,
  externalId: String? = nil,
  sourceAssetId: String? = nil,
  sourceProvider: String? = nil,
  locationCfi: String? = nil,
  highlightedAt: Date? = nil,
  highlightStyle: Int? = nil,
  createdAt: Date? = nil
) -> RecallItem {
  let now = Date()
  let intervals = settings.defaultIntervals.isEmpty ? RecallDefaults.intervals : settings.defaultIntervals

  return RecallItem(
    id: generateIdentifier(),
    content: draft.content.trimmingCharacters(in: .whitespacesAndNewlines),
    detail: draft.detail.trimmingCharacters(in: .whitespacesAndNewlines),
    categoryId: draft.categoryId,
    source: draft.source.trimmingCharacters(in: .whitespacesAndNewlines),
    priority: draft.priority,
    externalId: externalId,
    sourceAssetId: sourceAssetId,
    sourceProvider: sourceProvider,
    locationCfi: locationCfi,
    highlightedAt: highlightedAt,
    highlightStyle: highlightStyle,
    createdAt: createdAt ?? now,
    nextReviewDate: Calendar.current.date(byAdding: .day, value: intervals.first ?? 1, to: now) ?? now,
    currentInterval: intervals.first ?? 1,
    intervalIndex: 0,
    intervals: intervals,
    reviewCount: 0,
    lastReviewedAt: nil,
    status: .active
  )
}

func nextReviewUpdate(item: RecallItem, recalled: Bool) -> RecallItem {
  var updated = item
  let now = Date()

  if recalled {
    let nextIndex = min(item.intervalIndex + 1, item.intervals.count - 1)
    let nextInterval = item.intervals[nextIndex]
    updated.intervalIndex = nextIndex
    updated.currentInterval = nextInterval
    updated.nextReviewDate = Calendar.current.date(byAdding: .day, value: nextInterval, to: now) ?? now
  } else {
    let firstInterval = item.intervals.first ?? 1
    updated.intervalIndex = 0
    updated.currentInterval = firstInterval
    updated.nextReviewDate = Calendar.current.date(byAdding: .day, value: firstInterval, to: now) ?? now
  }

  updated.reviewCount += 1
  updated.lastReviewedAt = now
  return updated
}

func parseImportSummary(
  rawJSON: String,
  categories: [Category],
  settings: AppSettings,
  existingItems: [RecallItem],
  stagedHighlights: [StagedHighlight]
) -> (summary: ImportSummary, items: [RecallItem]) {
  let trimmed = rawJSON.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmed.isEmpty else {
    return (ImportSummary(total: 0, valid: 0, imported: 0, skippedDuplicates: 0, skippedInvalid: 0, warnings: [], errors: ["Please paste a JSON payload before importing."]), [])
  }

  guard let data = trimmed.data(using: .utf8) else {
    return (ImportSummary(total: 0, valid: 0, imported: 0, skippedDuplicates: 0, skippedInvalid: 0, warnings: [], errors: ["Unable to read JSON text."]), [])
  }

  let decoder = JSONDecoder()
  let payload: ImportPayload
  do {
    payload = try decoder.decode(ImportPayload.self, from: data)
  } catch {
    return (ImportSummary(total: 0, valid: 0, imported: 0, skippedDuplicates: 0, skippedInvalid: 0, warnings: [], errors: ["Invalid JSON format."]), [])
  }

  guard payload.version == 1 else {
    return (ImportSummary(total: 0, valid: 0, imported: 0, skippedDuplicates: 0, skippedInvalid: 0, warnings: [], errors: ["Unsupported payload version. Expected version: 1."]), [])
  }

  var warnings: [String] = []
  var invalid = 0
  var duplicates = 0
  var valid = 0
  var imported: [RecallItem] = []
  var dedupeKeys = Set(existingItems.map {
    buildImportDedupKey(
      externalId: $0.externalId,
      sourceAssetId: $0.sourceAssetId,
      content: $0.content,
      source: $0.source,
      locationCfi: $0.locationCfi
    )
  })

  stagedHighlights.forEach { highlight in
    dedupeKeys.insert(highlight.dedupeKey)
  }

  for (index, row) in payload.items.enumerated() {
    let rowIndex = index + 1
    guard let content = row.content?.trimmingCharacters(in: .whitespacesAndNewlines), !content.isEmpty else {
      invalid += 1
      warnings.append("Row \(rowIndex): Missing required non-empty content.")
      continue
    }

    valid += 1
    let mappedSource = row.source?.trimmingCharacters(in: .whitespacesAndNewlines).flatMap { $0.isEmpty ? nil : $0 }
      ?? payload.source?.bookTitle
      ?? ""
    let dedupeKey = buildImportDedupKey(
      externalId: row.externalId,
      sourceAssetId: payload.source?.assetId,
      content: content,
      source: mappedSource,
      locationCfi: row.meta?.locationCfi
    )

    if dedupeKeys.contains(dedupeKey) {
      duplicates += 1
      continue
    }

    dedupeKeys.insert(dedupeKey)
    let createdAt = row.meta?.highlightedAt.flatMap { ISO8601DateFormatter().date(from: $0) }
    let draft = AddItemDraft(
      content: content,
      detail: row.detail ?? "",
      source: mappedSource,
      categoryId: categories.resolveCategoryID(row.categoryId),
      priority: .from(style: row.meta?.style)
    )

    imported.append(
      createNewItem(
        draft: draft,
        settings: AppSettings(defaultIntervals: row.intervals ?? settings.defaultIntervals, dailyGoal: settings.dailyGoal, theme: settings.theme),
        externalId: row.externalId,
        sourceAssetId: payload.source?.assetId,
        sourceProvider: payload.source?.provider,
        locationCfi: row.meta?.locationCfi,
        highlightedAt: createdAt,
        highlightStyle: row.meta?.style,
        createdAt: createdAt
      )
    )
  }

  return (
    ImportSummary(
      total: payload.items.count,
      valid: valid,
      imported: imported.count,
      skippedDuplicates: duplicates,
      skippedInvalid: invalid,
      warnings: warnings,
      errors: []
    ),
    imported
  )
}

private func normalizeKeyPart(_ value: String?) -> String {
  value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression) ?? ""
}

private func generateIdentifier() -> String {
  "\(Int(Date().timeIntervalSince1970 * 1000), radix: 36)\(UUID().uuidString.prefix(8).lowercased())"
}
