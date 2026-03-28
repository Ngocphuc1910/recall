const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast1' });

const db = admin.firestore();
const { FieldValue } = admin.firestore;

exports.createAccountLinkCode = onCall(async (request) => {
  assertAuthenticated(request);
  const membership = await getMembership(request.auth.uid);

  if (!membership || membership.status !== 'active') {
    throw new HttpsError(
      'failed-precondition',
      'A stable account is required before generating a link code.'
    );
  }

  const code = generateLinkCode();
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000;

  await db.collection('accountLinkCodes').doc(code).set({
    code,
    targetAccountId: membership.accountId,
    createdByAuthUid: request.auth.uid,
    createdAt: now,
    expiresAt,
    status: 'pending',
  });

  return {
    code,
    targetAccountId: membership.accountId,
    createdByAuthUid: request.auth.uid,
    createdAt: now,
    expiresAt,
    status: 'pending',
  };
});

exports.redeemAccountLinkCode = onCall(async (request) => {
  assertAuthenticated(request);
  const code = String(request.data?.code ?? '').trim().toUpperCase();
  if (!code) {
    throw new HttpsError('invalid-argument', 'A link code is required.');
  }

  const [claimantMembership, codeSnapshot] = await Promise.all([
    getMembership(request.auth.uid),
    db.collection('accountLinkCodes').doc(code).get(),
  ]);

  if (!claimantMembership || claimantMembership.status !== 'active') {
    throw new HttpsError(
      'failed-precondition',
      'A stable account is required before redeeming a link code.'
    );
  }

  if (!codeSnapshot.exists) {
    throw new HttpsError('not-found', 'This link code does not exist.');
  }

  const linkCode = codeSnapshot.data();
  if (linkCode.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This link code is no longer usable.');
  }
  if (Number(linkCode.expiresAt ?? 0) < Date.now()) {
    await codeSnapshot.ref.set({ status: 'expired' }, { merge: true });
    throw new HttpsError('deadline-exceeded', 'This link code has expired.');
  }

  if (claimantMembership.accountId === linkCode.targetAccountId) {
    await codeSnapshot.ref.set(
      {
        claimedByAuthUid: request.auth.uid,
        claimedAt: Date.now(),
        status: 'redeemed',
      },
      { merge: true }
    );

    return { accountId: linkCode.targetAccountId, merged: false };
  }

  await mergeAccounts({
    sourceAccountId: claimantMembership.accountId,
    targetAccountId: linkCode.targetAccountId,
    claimantAuthUid: request.auth.uid,
  });

  await Promise.all([
    db.collection('memberships').doc(request.auth.uid).set(
      {
        accountId: linkCode.targetAccountId,
        lastLoginAt: Date.now(),
        status: 'active',
      },
      { merge: true }
    ),
    codeSnapshot.ref.set(
      {
        claimedByAuthUid: request.auth.uid,
        claimedAt: Date.now(),
        status: 'redeemed',
      },
      { merge: true }
    ),
  ]);

  return { accountId: linkCode.targetAccountId, merged: true };
});

exports.migrateLegacyUserData = onCall(async (request) => {
  assertAuthenticated(request);
  const membership = await getMembership(request.auth.uid);

  if (!membership?.accountId) {
    throw new HttpsError('failed-precondition', 'No account membership found.');
  }

  return migrateLegacyUserIntoAccount({
    authUid: request.auth.uid,
    accountId: membership.accountId,
  });
});

async function migrateLegacyUserIntoAccount({ authUid, accountId }) {
  const legacyMetaRef = db.doc(`users/${authUid}/meta/state`);
  const accountMetaRef = db.doc(`accounts/${accountId}/meta/state`);
  const profileRef = db.doc(`accounts/${accountId}/meta/profile`);

  const [
    legacyMetaSnapshot,
    accountMetaSnapshot,
    legacyItems,
    accountItems,
    legacyHighlights,
    accountHighlights,
    legacyRequests,
    accountRequests,
  ] = await Promise.all([
    legacyMetaRef.get(),
    accountMetaRef.get(),
    listCollection(`users/${authUid}/items`),
    listCollection(`accounts/${accountId}/items`),
    listCollection(`users/${authUid}/stagedHighlights`),
    listCollection(`accounts/${accountId}/stagedHighlights`),
    listCollection(`users/${authUid}/syncRequests`),
    listCollection(`accounts/${accountId}/syncRequests`),
  ]);

  const report = {
    sourceKind: 'legacy_user',
    sourceId: authUid,
    targetAccountId: accountId,
    copiedItems: 0,
    copiedStagedHighlights: 0,
    copiedSyncRequests: 0,
    mergedCategories: 0,
    performedAt: Date.now(),
  };

  const batch = db.batch();
  const mergedMeta = mergeMetaState(
    legacyMetaSnapshot.exists ? legacyMetaSnapshot.data() : null,
    accountMetaSnapshot.exists ? accountMetaSnapshot.data() : null
  );

  if (mergedMeta) {
    batch.set(accountMetaRef, mergedMeta, { merge: true });
    report.mergedCategories = mergedMeta.categories?.length ?? 0;
  }

  for (const item of mergeItems(accountItems, legacyItems)) {
    batch.set(db.doc(`accounts/${accountId}/items/${item.id}`), item, { merge: true });
    report.copiedItems += 1;
  }

  for (const highlight of mergeStagedHighlights(accountHighlights, legacyHighlights)) {
    batch.set(
      db.doc(`accounts/${accountId}/stagedHighlights/${highlight.id}`),
      highlight,
      { merge: true }
    );
    report.copiedStagedHighlights += 1;
  }

  for (const request of mergeSyncRequests(accountRequests, legacyRequests)) {
    batch.set(
      db.doc(`accounts/${accountId}/syncRequests/${request.id}`),
      request,
      { merge: true }
    );
    report.copiedSyncRequests += 1;
  }

  batch.set(
    profileRef,
    {
      migrationState: 'complete',
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  await batch.commit();
  return report;
}

async function mergeAccounts({ sourceAccountId, targetAccountId, claimantAuthUid }) {
  const [
    sourceMetaSnapshot,
    targetMetaSnapshot,
    sourceItems,
    targetItems,
    sourceHighlights,
    targetHighlights,
    sourceRequests,
    targetRequests,
  ] = await Promise.all([
    db.doc(`accounts/${sourceAccountId}/meta/state`).get(),
    db.doc(`accounts/${targetAccountId}/meta/state`).get(),
    listCollection(`accounts/${sourceAccountId}/items`),
    listCollection(`accounts/${targetAccountId}/items`),
    listCollection(`accounts/${sourceAccountId}/stagedHighlights`),
    listCollection(`accounts/${targetAccountId}/stagedHighlights`),
    listCollection(`accounts/${sourceAccountId}/syncRequests`),
    listCollection(`accounts/${targetAccountId}/syncRequests`),
  ]);

  const batch = db.batch();
  const targetProfileRef = db.doc(`accounts/${targetAccountId}/meta/profile`);
  const sourceProfileRef = db.doc(`accounts/${sourceAccountId}/meta/profile`);
  const mergedMeta = mergeMetaState(
    sourceMetaSnapshot.exists ? sourceMetaSnapshot.data() : null,
    targetMetaSnapshot.exists ? targetMetaSnapshot.data() : null
  );

  if (mergedMeta) {
    batch.set(db.doc(`accounts/${targetAccountId}/meta/state`), mergedMeta, { merge: true });
  }

  for (const item of mergeItems(targetItems, sourceItems)) {
    batch.set(db.doc(`accounts/${targetAccountId}/items/${item.id}`), item, { merge: true });
  }

  for (const highlight of mergeStagedHighlights(targetHighlights, sourceHighlights)) {
    batch.set(
      db.doc(`accounts/${targetAccountId}/stagedHighlights/${highlight.id}`),
      highlight,
      { merge: true }
    );
  }

  for (const request of mergeSyncRequests(targetRequests, sourceRequests)) {
    batch.set(
      db.doc(`accounts/${targetAccountId}/syncRequests/${request.id}`),
      request,
      { merge: true }
    );
  }

  batch.set(
    targetProfileRef,
    {
      mergedFromAccountIds: FieldValue.arrayUnion(sourceAccountId),
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  batch.set(
    sourceProfileRef,
    {
      status: 'merged',
      mergedIntoAccountId: targetAccountId,
      mergedAt: Date.now(),
      updatedAt: Date.now(),
      ownerAuthUid: claimantAuthUid,
    },
    { merge: true }
  );

  await batch.commit();
}

function mergeMetaState(source, target) {
  if (!source && !target) {
    return null;
  }

  const targetCategories = Array.isArray(target?.categories) ? target.categories : [];
  const mergedCategories = [...targetCategories];
  const knownIds = new Set(targetCategories.map((category) => category.id));

  for (const category of Array.isArray(source?.categories) ? source.categories : []) {
    if (!knownIds.has(category.id)) {
      mergedCategories.push(category);
      knownIds.add(category.id);
    }
  }

  return {
    categories: mergedCategories,
    settings: target?.settings ?? source?.settings ?? null,
    updatedAt: Date.now(),
  };
}

function mergeItems(existing, incoming) {
  const knownIds = new Set(existing.map((item) => item.id));
  const knownKeys = new Set(existing.map(buildItemDedupeKey));
  const toWrite = [];

  for (const item of incoming) {
    if (knownIds.has(item.id)) {
      continue;
    }

    const dedupeKey = buildItemDedupeKey(item);
    if (knownKeys.has(dedupeKey)) {
      continue;
    }

    knownIds.add(item.id);
    knownKeys.add(dedupeKey);
    toWrite.push(item);
  }

  return toWrite;
}

function mergeStagedHighlights(existing, incoming) {
  const byKey = new Map(existing.map((highlight) => [highlight.dedupeKey, highlight]));
  const toWrite = [];

  for (const highlight of incoming) {
    const current = byKey.get(highlight.dedupeKey);
    if (!current) {
      byKey.set(highlight.dedupeKey, highlight);
      toWrite.push(highlight);
      continue;
    }

    const preferred = choosePreferredHighlight(current, highlight);
    if (preferred.id !== current.id) {
      byKey.set(highlight.dedupeKey, preferred);
      toWrite.push(preferred);
    }
  }

  return toWrite;
}

function mergeSyncRequests(existing, incoming) {
  const knownIds = new Set(existing.map((request) => request.id));
  const toWrite = [];

  for (const request of incoming) {
    if (knownIds.has(request.id)) {
      continue;
    }
    if (request.status === 'pending' || request.status === 'running') {
      continue;
    }
    knownIds.add(request.id);
    toWrite.push(request);
  }

  return toWrite;
}

function choosePreferredHighlight(left, right) {
  const leftTerminal =
    left.approvalStatus === 'approved' || left.approvalStatus === 'rejected';
  const rightTerminal =
    right.approvalStatus === 'approved' || right.approvalStatus === 'rejected';

  if (leftTerminal && !rightTerminal) return left;
  if (!leftTerminal && rightTerminal) return right;

  return Number(right.updatedAt ?? 0) >= Number(left.updatedAt ?? 0) ? right : left;
}

function buildItemDedupeKey(item) {
  return buildImportDedupKey({
    externalId: item.externalId,
    sourceAssetId: item.sourceAssetId,
    content: item.content ?? '',
    source: item.source ?? '',
    locationCfi: item.locationCfi,
  });
}

function buildImportDedupKey({ externalId, sourceAssetId, content, source, locationCfi }) {
  const normalizedExternalId = normalizeKeyPart(externalId);
  const normalizedSourceAssetId = normalizeKeyPart(sourceAssetId);

  if (normalizedExternalId && normalizedSourceAssetId) {
    return `external_asset:${normalizedExternalId}::${normalizedSourceAssetId}`;
  }

  if (normalizedExternalId) {
    return `external:${normalizedExternalId}`;
  }

  return `content:${normalizeKeyPart(content)}::source:${normalizeKeyPart(
    source
  )}::cfi:${normalizeKeyPart(locationCfi)}`;
}

function normalizeKeyPart(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

async function getMembership(authUid) {
  const snapshot = await db.collection('memberships').doc(authUid).get();
  return snapshot.exists ? snapshot.data() : null;
}

async function listCollection(collectionPath) {
  const snapshot = await db.collection(collectionPath).get();
  return snapshot.docs.map((document) => ({
    ...document.data(),
    id: document.id,
  }));
}

function assertAuthenticated(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
}

function generateLinkCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
