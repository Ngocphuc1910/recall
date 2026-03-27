import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
import FirebaseFirestoreSwift

struct UserSession: Equatable {
  let uid: String
  let isAnonymous: Bool
}

enum FirebaseBootstrapError: LocalizedError {
  case missingGoogleServiceInfo

  var errorDescription: String? {
    switch self {
    case .missingGoogleServiceInfo:
      return "Missing GoogleService-Info.plist for the native iOS app."
    }
  }
}

enum FirebaseBootstrap {
  static func configure() throws {
    guard FirebaseApp.app() == nil else { return }

    if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
       let options = FirebaseOptions(contentsOfFile: path) {
      FirebaseApp.configure(options: options)
      let settings = Firestore.firestore().settings
      settings.isPersistenceEnabled = true
      Firestore.firestore().settings = settings
      return
    }

    throw FirebaseBootstrapError.missingGoogleServiceInfo
  }
}

protocol AuthServiceType {
  func ensureSignedIn() async throws -> UserSession
  func addStateListener(_ listener: @escaping (UserSession?) -> Void) -> NSObjectProtocol
  func removeStateListener(_ handle: NSObjectProtocol)
}

final class LiveAuthService: AuthServiceType {
  private let auth = Auth.auth()

  func ensureSignedIn() async throws -> UserSession {
    if let user = auth.currentUser {
      return UserSession(uid: user.uid, isAnonymous: user.isAnonymous)
    }

    let result = try await auth.signInAnonymously()
    return UserSession(uid: result.user.uid, isAnonymous: result.user.isAnonymous)
  }

  func addStateListener(_ listener: @escaping (UserSession?) -> Void) -> NSObjectProtocol {
    auth.addStateDidChangeListener { _, user in
      listener(user.map { UserSession(uid: $0.uid, isAnonymous: $0.isAnonymous) })
    }
  }

  func removeStateListener(_ handle: NSObjectProtocol) {
    guard let handle = handle as? AuthStateDidChangeListenerHandle else { return }
    auth.removeStateDidChangeListener(handle)
  }
}

final class FirestoreClient {
  let db: Firestore

  init(db: Firestore = Firestore.firestore()) {
    self.db = db
  }

  func metaDocument(uid: String) -> DocumentReference {
    db.collection("users").document(uid).collection("meta").document("state")
  }

  func itemsCollection(uid: String) -> CollectionReference {
    db.collection("users").document(uid).collection("items")
  }

  func itemDocument(uid: String, itemId: String) -> DocumentReference {
    itemsCollection(uid: uid).document(itemId)
  }

  func stagedHighlightsCollection(uid: String) -> CollectionReference {
    db.collection("users").document(uid).collection("stagedHighlights")
  }

  func stagedHighlightDocument(uid: String, id: String) -> DocumentReference {
    stagedHighlightsCollection(uid: uid).document(id)
  }

  func syncRequestsCollection(uid: String) -> CollectionReference {
    db.collection("users").document(uid).collection("syncRequests")
  }

  func syncRequestDocument(uid: String, id: String) -> DocumentReference {
    syncRequestsCollection(uid: uid).document(id)
  }
}
