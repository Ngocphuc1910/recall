import Foundation
import FirebaseFirestore
import FirebaseFirestoreSwift

protocol SettingsRepositoryType {
  func observeMeta(
    uid: String,
    onChange: @escaping (_ categories: [Category], _ settings: AppSettings) -> Void,
    onError: @escaping (Error) -> Void
  ) -> ListenerRegistration
  func updateSettings(uid: String, settings: AppSettings, categories: [Category]) async throws
}

protocol RecallRepositoryType {
  func observeItems(
    uid: String,
    onChange: @escaping ([RecallItem]) -> Void,
    onError: @escaping (Error) -> Void
  ) -> ListenerRegistration
  func addItem(uid: String, item: RecallItem) async throws
  func importItems(uid: String, items: [RecallItem]) async throws
  func updateItem(uid: String, item: RecallItem) async throws
  func deleteItem(uid: String, id: String) async throws
  func archiveItem(uid: String, id: String) async throws
  func mark(uid: String, item: RecallItem, recalled: Bool) async throws -> RecallItem
}

protocol ApprovalRepositoryType {
  func observeStagedHighlights(
    uid: String,
    onChange: @escaping ([StagedHighlight]) -> Void,
    onError: @escaping (Error) -> Void
  ) -> ListenerRegistration
  func updateCategory(uid: String, id: String, categoryId: String) async throws
  func updatePriority(uid: String, id: String, priority: Priority) async throws
  func approve(
    uid: String,
    highlight: StagedHighlight,
    existingItems: [RecallItem],
    settings: AppSettings
  ) async throws -> RecallItem?
  func reject(uid: String, id: String) async throws
  func approveAll(
    uid: String,
    highlights: [StagedHighlight],
    existingItems: [RecallItem],
    settings: AppSettings
  ) async throws -> [RecallItem]
  func rejectAll(uid: String, highlights: [StagedHighlight]) async throws
}

protocol SyncRequestRepositoryType {
  func observeSyncRequests(
    uid: String,
    onChange: @escaping ([SyncRequest]) -> Void,
    onError: @escaping (Error) -> Void
  ) -> ListenerRegistration
  func requestAppleBooksSync(uid: String) async throws
}

final class FirestoreSettingsRepository: SettingsRepositoryType {
  private let client: FirestoreClient

  init(client: FirestoreClient) {
    self.client = client
  }

  func observeMeta(
    uid: String,
    onChange: @escaping ([Category], AppSettings) -> Void,
    onError: @escaping (Error) -> Void
  ) -> ListenerRegistration {
    client.metaDocument(uid: uid).addSnapshotListener { snapshot, error in
      if let error {
        onError(error)
        return
      }

      guard let snapshot, snapshot.exists else {
        onChange(RecallDefaults.categories, RecallDefaults.settings)
        return
      }

      do {
        let state = try snapshot.data(as: MetaState.self)
        onChange(
          state.categories.map { $0.toDomain() }.sorted(by: { $0.order < $1.order }),
          state.settings.toDomain()
        )
      } catch {
        onError(error)
      }
    }
  }

  func updateSettings(uid: String, settings: AppSettings, categories: [Category]) async throws {
    let payload = MetaState(categories: categories.map { $0.toDTO() }, settings: settings.toDTO())
    try client.metaDocument(uid: uid).setData(from: payload, merge: true)
  }
}

final class FirestoreRecallRepository: RecallRepositoryType {
  private let client: FirestoreClient

  init(client: FirestoreClient) {
    self.client = client
  }

  func observeItems(
    uid: String,
    onChange: @escaping ([RecallItem]) -> Void,
    onError: @escaping (Error) -> Void
  ) -> ListenerRegistration {
    client.itemsCollection(uid: uid)
      .order(by: "createdAt", descending: true)
      .addSnapshotListener { snapshot, error in
        if let error {
          onError(error)
          return
        }

        guard let snapshot else {
          onChange([])
          return
        }

        let items = snapshot.documents.compactMap { document in
          try? document.data(as: RecallItemDTO.self).toDomain(id: document.documentID)
        }
        onChange(items)
      }
  }

  func addItem(uid: String, item: RecallItem) async throws {
    try client.itemDocument(uid: uid, itemId: item.id).setData(from: item.toDTO())
  }

  func importItems(uid: String, items: [RecallItem]) async throws {
    guard !items.isEmpty else { return }
    let batch = client.db.batch()
    for item in items {
      try batch.setData(from: item.toDTO(), forDocument: client.itemDocument(uid: uid, itemId: item.id))
    }
    try await batch.commit()
  }

  func updateItem(uid: String, item: RecallItem) async throws {
    try client.itemDocument(uid: uid, itemId: item.id).setData(from: item.toDTO(), merge: true)
  }

  func deleteItem(uid: String, id: String) async throws {
    try await client.itemDocument(uid: uid, itemId: id).delete()
  }

  func archiveItem(uid: String, id: String) async throws {
    try await client.itemDocument(uid: uid, itemId: id).updateData(["status": RecallStatus.archived.rawValue])
  }

  func mark(uid: String, item: RecallItem, recalled: Bool) async throws -> RecallItem {
    let updated = nextReviewUpdate(item: item, recalled: recalled)
    try client.itemDocument(uid: uid, itemId: updated.id).setData(from: updated.toDTO(), merge: true)
    return updated
  }
}

final class FirestoreApprovalRepository: ApprovalRepositoryType {
  private let client: FirestoreClient

  init(client: FirestoreClient) {
    self.client = client
  }

  func observeStagedHighlights(
    uid: String,
    onChange: @escaping ([StagedHighlight]) -> Void,
    onError: @escaping (Error) -> Void
  ) -> ListenerRegistration {
    client.stagedHighlightsCollection(uid: uid)
      .order(by: "syncedAt", descending: true)
      .addSnapshotListener { snapshot, error in
        if let error {
          onError(error)
          return
        }

        guard let snapshot else {
          onChange([])
          return
        }

        let highlights = snapshot.documents.compactMap { document in
          try? document.data(as: StagedHighlightDTO.self).toDomain(id: document.documentID)
        }
        onChange(highlights)
      }
  }

  func updateCategory(uid: String, id: String, categoryId: String) async throws {
    try await client.stagedHighlightDocument(uid: uid, id: id).updateData([
      "categoryId": categoryId,
      "categoryStatus": CategoryStatus.chosen.rawValue,
      "updatedAt": Date().milliseconds,
    ])
  }

  func updatePriority(uid: String, id: String, priority: Priority) async throws {
    try await client.stagedHighlightDocument(uid: uid, id: id).updateData([
      "priorityCode": priority.rawValue,
      "priorityLabel": priority.label,
      "updatedAt": Date().milliseconds,
    ])
  }

  func approve(
    uid: String,
    highlight: StagedHighlight,
    existingItems: [RecallItem],
    settings: AppSettings
  ) async throws -> RecallItem? {
    guard let categoryId = highlight.categoryId, highlight.categoryStatus == .chosen else {
      return nil
    }

    let isDuplicate = existingItems.contains {
      buildImportDedupKey(
        externalId: $0.externalId,
        sourceAssetId: $0.sourceAssetId,
        content: $0.content,
        source: $0.source,
        locationCfi: $0.locationCfi
      ) == highlight.dedupeKey
    }

    let now = Date().milliseconds
    let batch = client.db.batch()
    var importedItem: RecallItem?

    if !isDuplicate {
      let item = createNewItem(
        draft: AddItemDraft(
          content: highlight.content,
          detail: highlight.detail,
          source: highlight.source,
          categoryId: categoryId,
          priority: highlight.priority
        ),
        settings: settings,
        externalId: highlight.externalId,
        sourceAssetId: highlight.sourceAssetId,
        sourceProvider: highlight.sourceProvider,
        locationCfi: highlight.locationCfi,
        highlightedAt: highlight.highlightedAt,
        highlightStyle: highlight.highlightStyle,
        createdAt: highlight.createdAt
      )
      importedItem = item
      try batch.setData(from: item.toDTO(), forDocument: client.itemDocument(uid: uid, itemId: item.id))
    }

    batch.updateData([
      "approvalStatus": ApprovalStatus.approved.rawValue,
      "importStatus": isDuplicate ? ImportStatus.skippedDuplicate.rawValue : ImportStatus.imported.rawValue,
      "approvedAt": now,
      "updatedAt": now,
    ], forDocument: client.stagedHighlightDocument(uid: uid, id: highlight.id))

    try await batch.commit()
    return importedItem
  }

  func reject(uid: String, id: String) async throws {
    let now = Date().milliseconds
    try await client.stagedHighlightDocument(uid: uid, id: id).updateData([
      "approvalStatus": ApprovalStatus.rejected.rawValue,
      "rejectedAt": now,
      "updatedAt": now,
    ])
  }

  func approveAll(
    uid: String,
    highlights: [StagedHighlight],
    existingItems: [RecallItem],
    settings: AppSettings
  ) async throws -> [RecallItem] {
    guard !highlights.isEmpty else { return [] }

    let batch = client.db.batch()
    let now = Date().milliseconds
    var dedupeKeys = Set(existingItems.map {
      buildImportDedupKey(
        externalId: $0.externalId,
        sourceAssetId: $0.sourceAssetId,
        content: $0.content,
        source: $0.source,
        locationCfi: $0.locationCfi
      )
    })

    var imported: [RecallItem] = []

    for highlight in highlights where highlight.approvalStatus == .pending && highlight.categoryStatus == .chosen && highlight.categoryId != nil {
      let isDuplicate = dedupeKeys.contains(highlight.dedupeKey)

      if !isDuplicate, let categoryId = highlight.categoryId {
        dedupeKeys.insert(highlight.dedupeKey)
        let item = createNewItem(
          draft: AddItemDraft(
            content: highlight.content,
            detail: highlight.detail,
            source: highlight.source,
            categoryId: categoryId,
            priority: highlight.priority
          ),
          settings: settings,
          externalId: highlight.externalId,
          sourceAssetId: highlight.sourceAssetId,
          sourceProvider: highlight.sourceProvider,
          locationCfi: highlight.locationCfi,
          highlightedAt: highlight.highlightedAt,
          highlightStyle: highlight.highlightStyle,
          createdAt: highlight.createdAt
        )
        imported.append(item)
        try batch.setData(from: item.toDTO(), forDocument: client.itemDocument(uid: uid, itemId: item.id))
      }

      batch.updateData([
        "approvalStatus": ApprovalStatus.approved.rawValue,
        "importStatus": isDuplicate ? ImportStatus.skippedDuplicate.rawValue : ImportStatus.imported.rawValue,
        "approvedAt": now,
        "updatedAt": now,
      ], forDocument: client.stagedHighlightDocument(uid: uid, id: highlight.id))
    }

    try await batch.commit()
    return imported
  }

  func rejectAll(uid: String, highlights: [StagedHighlight]) async throws {
    guard !highlights.isEmpty else { return }
    let batch = client.db.batch()
    let now = Date().milliseconds
    for highlight in highlights where highlight.approvalStatus == .pending {
      batch.updateData([
        "approvalStatus": ApprovalStatus.rejected.rawValue,
        "rejectedAt": now,
        "updatedAt": now,
      ], forDocument: client.stagedHighlightDocument(uid: uid, id: highlight.id))
    }
    try await batch.commit()
  }
}

final class FirestoreSyncRequestRepository: SyncRequestRepositoryType {
  private let client: FirestoreClient

  init(client: FirestoreClient) {
    self.client = client
  }

  func observeSyncRequests(
    uid: String,
    onChange: @escaping ([SyncRequest]) -> Void,
    onError: @escaping (Error) -> Void
  ) -> ListenerRegistration {
    client.syncRequestsCollection(uid: uid)
      .order(by: "requestedAt", descending: true)
      .limit(to: 20)
      .addSnapshotListener { snapshot, error in
        if let error {
          onError(error)
          return
        }

        guard let snapshot else {
          onChange([])
          return
        }

        let requests = snapshot.documents.compactMap { document in
          try? document.data(as: SyncRequestDTO.self).toDomain(id: document.documentID)
        }
        onChange(requests)
      }
  }

  func requestAppleBooksSync(uid: String) async throws {
    let snapshot = try await client.syncRequestsCollection(uid: uid)
      .whereField("source", isEqualTo: SyncSource.appleBooks.rawValue)
      .whereField("status", in: [SyncRequestStatus.pending.rawValue, SyncRequestStatus.running.rawValue])
      .getDocuments()

    if !snapshot.documents.isEmpty {
      return
    }

    let document = client.syncRequestsCollection(uid: uid).document()
    try await document.setData([
      "id": document.documentID,
      "source": SyncSource.appleBooks.rawValue,
      "status": SyncRequestStatus.pending.rawValue,
      "requestedAt": Date().milliseconds,
      "lastSeenAt": Date().milliseconds,
    ])
  }
}
