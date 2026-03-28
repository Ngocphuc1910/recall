import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PROJECT_ID = getProjectId();
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function main() {
  const { sourceUid, targetUid, dryRun } = parseArgs(process.argv.slice(2));
  const accessToken = getAccessToken();

  if (sourceUid === targetUid) {
    throw new Error('Source UID and target UID must be different.');
  }

  console.log(`Migrating data in Firebase project ${PROJECT_ID}`);
  console.log(`Source UID: ${sourceUid}`);
  console.log(`Target UID: ${targetUid}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'write'}`);

  const sourceMeta = await getDocument(`users/${sourceUid}/meta/state`, accessToken);
  const sourceItems = await listDocuments(`users/${sourceUid}/items`, accessToken);
  const sourceHighlights = await listDocuments(
    `users/${sourceUid}/stagedHighlights`,
    accessToken
  );
  const sourceRequests = await listDocuments(`users/${sourceUid}/syncRequests`, accessToken);

  console.log(`Found ${sourceItems.length} items`);
  console.log(`Found ${sourceHighlights.length} staged highlights`);
  console.log(`Found ${sourceRequests.length} sync requests`);
  console.log(`Found meta document: ${sourceMeta ? 'yes' : 'no'}`);

  const writes = [];

  if (sourceMeta) {
    writes.push(
      buildSetWrite(`users/${targetUid}/meta/state`, {
        ...sourceMeta.data,
        migratedFromUserId: sourceUid,
        migratedAt: Date.now(),
      })
    );
  }

  sourceItems.forEach((document) => {
    writes.push(buildSetWrite(`users/${targetUid}/items/${document.id}`, document.data));
  });

  sourceHighlights.forEach((document) => {
    writes.push(
      buildSetWrite(`users/${targetUid}/stagedHighlights/${document.id}`, document.data)
    );
  });

  sourceRequests.forEach((document) => {
    writes.push(buildSetWrite(`users/${targetUid}/syncRequests/${document.id}`, document.data));
  });

  console.log(`Prepared ${writes.length} writes`);

  if (dryRun || writes.length === 0) {
    return;
  }

  await commitWrites(writes, accessToken);
  console.log('Migration complete.');
}

function parseArgs(args) {
  const sourceUid = args.find((arg) => arg.startsWith('--source='))?.split('=')[1];
  const targetUid = args.find((arg) => arg.startsWith('--target='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  if (!sourceUid || !targetUid) {
    throw new Error(
      'Usage: node scripts/migrate-firebase-user-data.mjs --source=<uid> --target=<uid> [--dry-run]'
    );
  }

  return { sourceUid, targetUid, dryRun };
}

async function getDocument(documentPath, accessToken) {
  const response = await fetch(`${FIRESTORE_BASE}/${documentPath}`, {
    headers: buildHeaders(accessToken),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to fetch ${documentPath}: ${response.status}`);
  }

  const document = await response.json();
  return {
    id: document.name.split('/').at(-1),
    name: document.name,
    data: decodeMap(document.fields ?? {}),
  };
}

async function listDocuments(collectionPath, accessToken) {
  const response = await fetch(
    `${FIRESTORE_BASE}/${collectionPath}?pageSize=1000`,
    {
      headers: buildHeaders(accessToken),
    }
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Unable to list documents for ${collectionPath}: ${response.status}`);
  }

  const payload = await response.json();
  return (payload.documents ?? []).map((document) => ({
    id: document.name.split('/').at(-1),
    name: document.name,
    data: decodeMap(document.fields ?? {}),
  }));
}

function buildSetWrite(documentPath, data) {
  return {
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/${documentPath}`,
      fields: encodeMap(data),
    },
  };
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
        values: value.map((entry) => encodeValue(entry)).filter(Boolean),
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

function buildHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
