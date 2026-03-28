import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PROJECT_ID = getProjectId();
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1);
const ANNOTATION_DB = path.join(
  os.homedir(),
  'Library/Containers/com.apple.iBooksX/Data/Documents/AEAnnotation/AEAnnotation_v10312011_1727_local.sqlite'
);
const LIBRARY_DB = path.join(
  os.homedir(),
  'Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary/BKLibrary-1-091020131601.sqlite'
);
const WATCH_MODE = process.argv.includes('--watch');
const INTERVAL_SECONDS = getIntervalSeconds();
const PRIORITY_LABEL_BY_CODE = {
  1: 'High',
  2: 'Medium',
  3: 'Low',
  4: 'Critical',
  5: 'MindFuck',
};

async function main() {
  if (WATCH_MODE) {
    console.log(
      `Watching Apple Books sync requests for Firebase project ${PROJECT_ID} every ${INTERVAL_SECONDS}s`
    );
    while (true) {
      await processPendingRequests();
      await wait(INTERVAL_SECONDS * 1000);
    }
  }

  await processPendingRequests();
}

async function processPendingRequests() {
  const accessToken = getAccessToken();
  const requests = await fetchCollectionGroup('syncRequests', accessToken);
  const pendingRequests = requests
    .filter(
      (request) =>
        request.data?.source === 'apple_books' && request.data?.status === 'pending'
    )
    .sort(
      (left, right) =>
        Number(left.data?.requestedAt ?? 0) - Number(right.data?.requestedAt ?? 0)
    );

  if (pendingRequests.length === 0) {
    if (!WATCH_MODE) {
      console.log('No pending Apple Books sync requests.');
    }
    return;
  }

  const localHighlights = loadAppleBooksHighlights();

  for (const request of pendingRequests) {
    try {
      console.log(
        `Processing Apple Books sync request ${request.id} for ${request.ownerCollection}/${request.ownerId}`
      );
      await patchDocument(
        request.name,
        {
          status: 'running',
          startedAt: Date.now(),
          lastSeenAt: Date.now(),
        },
        accessToken
      );

      const existingItems = await listDocuments(
        `${request.ownerCollection}/${request.ownerId}/items`,
        accessToken
      );
      const existingStagedHighlights = await listDocuments(
        `${request.ownerCollection}/${request.ownerId}/stagedHighlights`,
        accessToken
      );

      const existingKeys = buildExistingDedupeKeys(
        existingItems,
        existingStagedHighlights
      );

      const stagedDocs = [];
      let duplicateCount = 0;

      for (const highlight of localHighlights) {
        if (existingKeys.has(highlight.dedupeKey)) {
          duplicateCount += 1;
          continue;
        }

        existingKeys.add(highlight.dedupeKey);
        stagedDocs.push(highlight);
      }

      if (stagedDocs.length > 0) {
        const writes = stagedDocs.map((highlight) => ({
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/${request.ownerCollection}/${request.ownerId}/stagedHighlights/${highlight.id}`,
            fields: encodeMap(highlight),
          },
        }));

        await commitWrites(writes, accessToken);
      }

      const summary = `Imported ${stagedDocs.length} new highlight${
        stagedDocs.length === 1 ? '' : 's'
      }, skipped ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}.`;

      await patchDocument(
        request.name,
        {
          status: 'completed',
          completedAt: Date.now(),
          lastSeenAt: Date.now(),
          resultSummary: summary,
        },
        accessToken
      );

      console.log(summary);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`Sync request ${request.id} failed: ${message}`);
      await patchDocument(
        request.name,
        {
          status: 'failed',
          completedAt: Date.now(),
          lastSeenAt: Date.now(),
          error: message,
        },
        accessToken
      );
    }
  }
}

function loadAppleBooksHighlights() {
  if (!fs.existsSync(ANNOTATION_DB) || !fs.existsSync(LIBRARY_DB)) {
    throw new Error('Apple Books databases were not found on this Mac.');
  }

  const query = `
    ATTACH DATABASE '${escapeSqlitePath(LIBRARY_DB)}' AS library;
    SELECT
      annotation.ZANNOTATIONUUID AS externalId,
      annotation.ZANNOTATIONASSETID AS sourceAssetId,
      annotation.ZANNOTATIONSELECTEDTEXT AS content,
      COALESCE(annotation.ZANNOTATIONNOTE, '') AS detail,
      annotation.ZANNOTATIONLOCATION AS locationCfi,
      annotation.ZANNOTATIONCREATIONDATE AS creationDate,
      annotation.ZANNOTATIONSTYLE AS highlightStyle,
      libraryAsset.ZTITLE AS bookTitle,
      libraryAsset.ZAUTHOR AS author
    FROM ZAEANNOTATION annotation
    LEFT JOIN library.ZBKLIBRARYASSET libraryAsset
      ON libraryAsset.ZASSETID = annotation.ZANNOTATIONASSETID
    WHERE annotation.ZANNOTATIONSELECTEDTEXT IS NOT NULL
      AND LENGTH(TRIM(annotation.ZANNOTATIONSELECTEDTEXT)) > 0
      AND IFNULL(annotation.ZANNOTATIONDELETED, 0) = 0
    ORDER BY annotation.ZANNOTATIONCREATIONDATE DESC;
  `;

  const rows = runSqliteJson(ANNOTATION_DB, query);
  const now = Date.now();

  return rows.map((row) => {
    const content = normalizeString(row.content);
    const detail = normalizeString(row.detail) ?? '';
    const source = normalizeString(row.bookTitle) ?? 'Apple Books';
    const highlightedAt = toIsoString(row.creationDate);
    const highlightStyle = normalizePriorityCode(parseInteger(row.highlightStyle));
    const createdAt = parseCreatedAtFromHighlightedAt(highlightedAt) ?? now;
    const dedupeKey = buildDedupeKey({
      externalId: normalizeString(row.externalId),
      sourceAssetId: normalizeString(row.sourceAssetId),
      content,
      source,
      locationCfi: normalizeString(row.locationCfi),
    });

    return {
      id: buildStageId(normalizeString(row.externalId), dedupeKey),
      content,
      detail,
      source,
      categoryId: 'books',
      categoryStatus: 'chosen',
      dedupeKey,
      approvalStatus: 'pending',
      importStatus: 'staged',
      sourceProvider: 'apple_books',
      externalId: normalizeString(row.externalId),
      sourceAssetId: normalizeString(row.sourceAssetId),
      locationCfi: normalizeString(row.locationCfi),
      highlightedAt,
      highlightStyle,
      priorityCode: highlightStyle,
      priorityLabel: PRIORITY_LABEL_BY_CODE[highlightStyle],
      raw: {
        bookTitle: normalizeString(row.bookTitle),
        author: normalizeString(row.author),
      },
      syncedAt: now,
      createdAt,
      updatedAt: now,
    };
  });
}

async function fetchCollectionGroup(collectionId, accessToken) {
  const response = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: buildHeaders(accessToken),
    body: JSON.stringify({
      structuredQuery: {
        from: [
          {
            collectionId,
            allDescendants: true,
          },
        ],
        limit: 100,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to query ${collectionId}: ${response.status}`);
  }

  const payload = await response.json();

  return payload
    .filter((entry) => entry.document)
    .map((entry) => {
      const name = entry.document.name;
      const parts = name.split('/');
      return {
        name,
        id: parts[parts.length - 1],
        ownerCollection: parts[parts.length - 4],
        ownerId: parts[parts.length - 3],
        data: decodeMap(entry.document.fields ?? {}),
      };
    });
}

async function listDocuments(collectionPath, accessToken) {
  const response = await fetch(
    `${FIRESTORE_BASE}/${collectionPath}?pageSize=1000`,
    {
      headers: buildHeaders(accessToken),
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to list documents for ${collectionPath}`);
  }

  const payload = await response.json();
  return (payload.documents ?? []).map((document) => ({
    id: document.name.split('/').at(-1),
    name: document.name,
    data: decodeMap(document.fields ?? {}),
  }));
}

async function commitWrites(writes, accessToken) {
  const chunkSize = 400;

  for (let index = 0; index < writes.length; index += chunkSize) {
    const response = await fetch(`${FIRESTORE_BASE}:commit`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({
        writes: writes.slice(index, index + chunkSize),
      }),
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Commit failed: ${payload}`);
    }
  }
}

async function patchDocument(documentName, values, accessToken) {
  const params = new URLSearchParams();
  Object.keys(values).forEach((key) => {
    params.append('updateMask.fieldPaths', key);
  });

  const response = await fetch(
    `https://firestore.googleapis.com/v1/${documentName}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({
        fields: encodeMap(values),
      }),
    }
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Patch failed: ${payload}`);
  }
}

function buildExistingDedupeKeys(items, stagedHighlights) {
  const keys = new Set();

  items.forEach((item) => {
    keys.add(
      buildDedupeKey({
        externalId: item.data.externalId,
        sourceAssetId: item.data.sourceAssetId,
        content: item.data.content ?? '',
        source: item.data.source ?? '',
        locationCfi: item.data.locationCfi,
      })
    );
  });

  stagedHighlights.forEach((highlight) => {
    if (highlight.data.dedupeKey) {
      keys.add(highlight.data.dedupeKey);
    }
  });

  return keys;
}

function buildStageId(externalId, dedupeKey) {
  if (externalId) {
    return externalId;
  }

  return crypto.createHash('sha1').update(dedupeKey).digest('hex');
}

function buildDedupeKey({
  externalId,
  sourceAssetId,
  content,
  source,
  locationCfi,
}) {
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
  return normalizeString(value)?.toLowerCase() ?? '';
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseInteger(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizePriorityCode(value) {
  const parsed = Number(value);
  if (parsed >= 1 && parsed <= 5) {
    return Math.trunc(parsed);
  }

  return 2;
}

function parseCreatedAtFromHighlightedAt(highlightedAt) {
  if (!highlightedAt) {
    return undefined;
  }

  const parsed = Date.parse(highlightedAt);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoString(coreDataSeconds) {
  const seconds = Number(coreDataSeconds);
  if (!Number.isFinite(seconds)) {
    return undefined;
  }

  return new Date(APPLE_EPOCH_MS + seconds * 1000).toISOString();
}

function encodeMap(value) {
  const fields = {};

  Object.entries(value).forEach(([key, entry]) => {
    const encoded = encodeValue(entry);
    if (encoded) {
      fields[key] = encoded;
    }
  });

  return fields;
}

function encodeValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value
          .map((entry) => encodeValue(entry))
          .filter(Boolean),
      },
    };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }

    return { doubleValue: value };
  }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: encodeMap(value),
      },
    };
  }

  return null;
}

function decodeMap(fields) {
  const output = {};

  Object.entries(fields).forEach(([key, value]) => {
    output[key] = decodeValue(value);
  });

  return output;
}

function decodeValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) return decodeMap(value.mapValue.fields ?? {});
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map((entry) => decodeValue(entry));
  }
  return undefined;
}

function runSqliteJson(databasePath, query) {
  const result = execFileSync('sqlite3', ['-json', databasePath, query], {
    encoding: 'utf8',
  });
  return JSON.parse(result);
}

function getAccessToken() {
  try {
    return execFileSync('gcloud', ['auth', 'print-access-token'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return execFileSync(
      'gcloud',
      ['auth', 'application-default', 'print-access-token'],
      {
        encoding: 'utf8',
      }
    ).trim();
  }
}

function getProjectId() {
  if (process.env.RECALL_FIREBASE_PROJECT_ID) {
    return process.env.RECALL_FIREBASE_PROJECT_ID;
  }

  const firebasercPath = path.join(process.cwd(), '.firebaserc');
  const contents = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));
  return contents.projects?.default ?? 'recall-memory-20260326';
}

function escapeSqlitePath(value) {
  return value.replace(/'/g, "''");
}

function buildHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function getIntervalSeconds() {
  const intervalArg = process.argv.find((argument) =>
    argument.startsWith('--interval=')
  );

  if (!intervalArg) {
    return 15;
  }

  const parsed = Number.parseInt(intervalArg.split('=')[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
