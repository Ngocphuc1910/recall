import SwiftUI
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class RecallAppState: ObservableObject {
  @Published var selectedTab: RecallTab = .today
  @Published var categories: [Category] = RecallDefaults.categories
  @Published var settings: AppSettings = RecallDefaults.settings
  @Published var items: [RecallItem] = RecallPreviewData.items
  @Published var stagedHighlights: [StagedHighlight] = RecallPreviewData.stagedHighlights
  @Published var syncRequests: [SyncRequest] = RecallPreviewData.syncRequests
  @Published var cloudAuthStatus: CloudAuthStatus = .idle
  @Published var cloudSyncStatus: CloudSyncStatus = .local
  @Published var cloudError: String?
  @Published var userID: String?
  @Published var importResultSummary: String?
  @Published var isPreviewMode = false

  private var metaListener: ListenerRegistration?
  private var itemsListener: ListenerRegistration?
  private var stagedHighlightsListener: ListenerRegistration?
  private var syncRequestsListener: ListenerRegistration?
  private var authHandle: AuthStateDidChangeListenerHandle?

  private let authService: AuthServiceType?
  private let settingsRepository: SettingsRepositoryType?
  private let recallRepository: RecallRepositoryType?
  private let approvalRepository: ApprovalRepositoryType?
  private let syncRequestRepository: SyncRequestRepositoryType?

  init() {
    do {
      try FirebaseBootstrap.configure()
      let client = FirestoreClient()
      let authService = LiveAuthService()
      self.authService = authService
      settingsRepository = FirestoreSettingsRepository(client: client)
      recallRepository = FirestoreRecallRepository(client: client)
      approvalRepository = FirestoreApprovalRepository(client: client)
      syncRequestRepository = FirestoreSyncRequestRepository(client: client)
      attachAuth(authService)
    } catch {
      isPreviewMode = true
      cloudAuthStatus = .error
      cloudSyncStatus = .local
      cloudError = error.localizedDescription
      authService = nil
      settingsRepository = nil
      recallRepository = nil
      approvalRepository = nil
      syncRequestRepository = nil
    }
  }

  deinit {
    metaListener?.remove()
    itemsListener?.remove()
    stagedHighlightsListener?.remove()
    syncRequestsListener?.remove()
    if let authService, let authHandle {
      authService.removeStateListener(authHandle)
    }
  }

  var todayItems: [RecallItem] {
    items.filter { $0.isDueToday }
  }

  var pendingHighlights: [StagedHighlight] {
    stagedHighlights.filter { $0.approvalStatus == .pending }
  }

  func addItem(draft: AddItemDraft) async {
    if isPreviewMode {
      items.insert(
        createNewItem(draft: draft, settings: settings),
        at: 0
      )
      return
    }

    guard let userID, let recallRepository else { return }
    do {
      let item = createNewItem(draft: draft, settings: settings)
      try await recallRepository.addItem(uid: userID, item: item)
      Haptics.success()
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func mark(item: RecallItem, recalled: Bool) async {
    if isPreviewMode {
      if let index = items.firstIndex(where: { $0.id == item.id }) {
        items[index] = nextReviewUpdate(item: item, recalled: recalled)
      }
      recalled ? Haptics.success() : Haptics.warning()
      return
    }

    guard let userID, let recallRepository else { return }
    do {
      _ = try await recallRepository.mark(uid: userID, item: item, recalled: recalled)
      recalled ? Haptics.success() : Haptics.warning()
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func updatePriority(for item: RecallItem, priority: Priority) async {
    var updated = item
    updated.priority = priority

    if isPreviewMode {
      if let index = items.firstIndex(where: { $0.id == item.id }) {
        items[index] = updated
      }
      return
    }

    guard let userID, let recallRepository else { return }
    do {
      try await recallRepository.updateItem(uid: userID, item: updated)
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func archive(item: RecallItem) async {
    if isPreviewMode {
      if let index = items.firstIndex(where: { $0.id == item.id }) {
        items[index].status = .archived
      }
      return
    }

    guard let userID, let recallRepository else { return }
    do {
      try await recallRepository.archiveItem(uid: userID, id: item.id)
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func requestAppleBooksSync() async {
    if isPreviewMode {
      syncRequests.insert(
        SyncRequest(
          id: UUID().uuidString,
          source: .appleBooks,
          status: .pending,
          requestedAt: Date(),
          startedAt: nil,
          completedAt: nil,
          lastSeenAt: Date(),
          resultSummary: "Preview mode only. Add GoogleService-Info.plist for live sync.",
          error: nil
        ),
        at: 0
      )
      return
    }

    guard let userID, let syncRequestRepository else { return }
    do {
      try await syncRequestRepository.requestAppleBooksSync(uid: userID)
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func updateStagedCategory(id: String, categoryId: String) async {
    if isPreviewMode {
      if let index = stagedHighlights.firstIndex(where: { $0.id == id }) {
        stagedHighlights[index].categoryId = categoryId
        stagedHighlights[index].categoryStatus = .chosen
      }
      return
    }

    guard let userID, let approvalRepository else { return }
    do {
      try await approvalRepository.updateCategory(uid: userID, id: id, categoryId: categoryId)
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func updateStagedPriority(id: String, priority: Priority) async {
    if isPreviewMode {
      if let index = stagedHighlights.firstIndex(where: { $0.id == id }) {
        stagedHighlights[index].priority = priority
      }
      return
    }

    guard let userID, let approvalRepository else { return }
    do {
      try await approvalRepository.updatePriority(uid: userID, id: id, priority: priority)
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func approve(highlights: [StagedHighlight]) async {
    if isPreviewMode {
      highlights.forEach { highlight in
        guard let categoryId = highlight.categoryId else { return }
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
        items.insert(item, at: 0)
      }
      stagedHighlights = stagedHighlights.map { highlight in
        if highlights.contains(where: { $0.id == highlight.id }) {
          var updated = highlight
          updated.approvalStatus = .approved
          updated.importStatus = .imported
          return updated
        }
        return highlight
      }
      Haptics.success()
      return
    }

    guard let userID, let approvalRepository else { return }
    do {
      _ = try await approvalRepository.approveAll(
        uid: userID,
        highlights: highlights,
        existingItems: items,
        settings: settings
      )
      Haptics.success()
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func reject(highlights: [StagedHighlight]) async {
    if isPreviewMode {
      stagedHighlights = stagedHighlights.map { highlight in
        if highlights.contains(where: { $0.id == highlight.id }) {
          var updated = highlight
          updated.approvalStatus = .rejected
          updated.rejectedAt = Date()
          return updated
        }
        return highlight
      }
      return
    }

    guard let userID, let approvalRepository else { return }
    do {
      try await approvalRepository.rejectAll(uid: userID, highlights: highlights)
    } catch {
      cloudError = error.localizedDescription
    }
  }

  func importJSON(_ text: String) {
    let result = parseImportSummary(
      rawJSON: text,
      categories: categories,
      settings: settings,
      existingItems: items,
      stagedHighlights: stagedHighlights
    )

    importResultSummary = """
    Total rows: \(result.summary.total)
    Valid rows: \(result.summary.valid)
    Imported: \(result.summary.imported)
    Skipped duplicates: \(result.summary.skippedDuplicates)
    Skipped invalid: \(result.summary.skippedInvalid)
    \(result.summary.warnings.joined(separator: "\n"))
    \(result.summary.errors.joined(separator: "\n"))
    """

    if isPreviewMode {
      items.insert(contentsOf: result.items, at: 0)
    }
  }

  private func attachAuth(_ authService: AuthServiceType) {
    cloudAuthStatus = .connecting
    authHandle = authService.addStateListener { [weak self] session in
      Task { @MainActor in
        guard let self else { return }
        if let session {
          userID = session.uid
          cloudAuthStatus = .connected
          cloudSyncStatus = .syncing
          attachRepositories(for: session.uid)
          return
        }

        do {
          _ = try await authService.ensureSignedIn()
        } catch {
          cloudAuthStatus = .error
          cloudSyncStatus = .error
          cloudError = error.localizedDescription
        }
      }
    }

    Task {
      do {
        _ = try await authService.ensureSignedIn()
      } catch {
        cloudAuthStatus = .error
        cloudSyncStatus = .error
        cloudError = error.localizedDescription
      }
    }
  }

  private func attachRepositories(for uid: String) {
    metaListener?.remove()
    itemsListener?.remove()
    stagedHighlightsListener?.remove()
    syncRequestsListener?.remove()

    if let settingsRepository {
      metaListener = settingsRepository.observeMeta(
        uid: uid,
        onChange: { [weak self] categories, settings in
          Task { @MainActor in
            self?.categories = categories
            self?.settings = settings
            self?.cloudSyncStatus = .synced
          }
        },
        onError: { [weak self] error in
          Task { @MainActor in
            self?.cloudError = error.localizedDescription
            self?.cloudSyncStatus = .error
          }
        }
      )
    }

    if let recallRepository {
      itemsListener = recallRepository.observeItems(
        uid: uid,
        onChange: { [weak self] items in
          Task { @MainActor in
            self?.items = items
          }
        },
        onError: { [weak self] error in
          Task { @MainActor in
            self?.cloudError = error.localizedDescription
          }
        }
      )
    }

    if let approvalRepository {
      stagedHighlightsListener = approvalRepository.observeStagedHighlights(
        uid: uid,
        onChange: { [weak self] highlights in
          Task { @MainActor in
            self?.stagedHighlights = highlights
          }
        },
        onError: { [weak self] error in
          Task { @MainActor in
            self?.cloudError = error.localizedDescription
          }
        }
      )
    }

    if let syncRequestRepository {
      syncRequestsListener = syncRequestRepository.observeSyncRequests(
        uid: uid,
        onChange: { [weak self] requests in
          Task { @MainActor in
            self?.syncRequests = requests
          }
        },
        onError: { [weak self] error in
          Task { @MainActor in
            self?.cloudError = error.localizedDescription
          }
        }
      )
    }
  }
}
