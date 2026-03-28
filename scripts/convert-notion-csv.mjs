import fs from 'node:fs';
import path from 'node:path';

const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows.filter((current) => current.some((value) => value.trim() !== ''));
}

function normalizeHeader(value) {
  return value.replace(/^\uFEFF/, '').trim();
}

function parseRows(csvText) {
  const [headerRow, ...dataRows] = parseCsv(csvText);
  const headers = headerRow.map(normalizeHeader);

  return dataRows.map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
}

function stripOuterQuotes(value) {
  let result = value.trim();
  while (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'")) ||
    (result.startsWith('“') && result.endsWith('”')) ||
    (result.startsWith('‘') && result.endsWith('’'))
  ) {
    result = result.slice(1, -1).trim();
  }
  return result;
}

function normalizeTypography(value) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\u00A0/g, ' ');
}

function cleanContent(rawValue) {
  let value = normalizeTypography(rawValue ?? '');
  value = value.replace(/[\[(]?\s*https?:\/\/\S+\s*[\])]?/gi, ' ');
  value = value.replace(/\/{3,}/g, ' ');
  value = value.replace(/\s+/g, ' ');
  value = value.replace(/\(\s*\)/g, ' ');
  value = value.replace(/\[\s*\]/g, ' ');
  value = stripOuterQuotes(value);
  value = value.replace(/^"+|"+$/g, '');
  value = value.replace(/^'+|'+$/g, '');
  value = value.replace(/\s+([,.;:!?])/g, '$1');
  value = value.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  value = value.replace(/[\[(]\s*$/g, '');
  return value.trim();
}

function extractDetail(rawValue) {
  const urls = [...String(rawValue ?? '').matchAll(/https?:\/\/\S+/gi)].map(
    (match) => match[0].replace(/[\]),.;]+$/, '')
  );

  if (urls.length === 0) return undefined;
  return urls.join(' | ');
}

function parseDateToIso(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) return undefined;

  const match = value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return undefined;

  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (month === undefined || !Number.isInteger(day) || !Number.isInteger(year)) {
    return undefined;
  }

  return new Date(Date.UTC(year, month, day)).toISOString().replace('.000', '');
}

function parseInterval(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) return undefined;

  const match = value.match(/(\d+)/);
  if (!match) return undefined;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getSessionValues(record) {
  return Object.entries(record)
    .map(([key, value]) => {
      const match = key.match(/^Session\s+(\d+)$/i);
      if (!match) return undefined;
      return {
        session: Number(match[1]),
        value: parseInterval(value),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.session - b.session);
}

function inferStyle(sessionValues) {
  const early = sessionValues
    .filter((entry) => entry.session >= 1 && entry.session <= 5)
    .map((entry) => entry.value)
    .filter((value) => Number.isInteger(value));

  if (early.length === 0) return 2;

  const average = early.reduce((sum, value) => sum + value, 0) / early.length;

  if (average <= 5) return 5;
  if (average <= 10) return 4;
  if (average <= 20) return 1;
  if (average <= 40) return 2;
  return 3;
}

function buildItem(record, externalId) {
  const rawContent = record['Name of Book'] ?? '';
  const content = cleanContent(rawContent);
  if (!content) return undefined;

  const detail = extractDetail(rawContent);
  const sessionValues = getSessionValues(record);
  const sortedIntervals = sessionValues
    .map((entry) => entry.value)
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b);

  const item = {
    externalId,
    content,
    source: 'Notion',
    categoryId: 'quotes',
    meta: {
      highlightedAt: parseDateToIso(record['Record Date']),
      style: inferStyle(sessionValues),
    },
  };

  if (detail) {
    item.detail = detail;
  }

  if (sortedIntervals.length > 0) {
    item.intervals = sortedIntervals;
  }

  if (!item.meta.highlightedAt) {
    delete item.meta.highlightedAt;
  }

  return item;
}

function convertFile(inputPath, outputPath, startIndex) {
  const csvText = fs.readFileSync(inputPath, 'utf8');
  const records = parseRows(csvText);

  const items = [];
  let nextId = startIndex;

  for (const record of records) {
    const item = buildItem(record, `notion-${nextId}`);
    if (!item) continue;
    items.push(item);
    nextId += 1;
  }

  const payload = {
    version: 1,
    items,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

  return {
    totalRows: records.length,
    items: items.length,
    nextId,
  };
}

const [, , inputPath, outputPath, startIndexRaw] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert-notion-csv.mjs <input.csv> <output.json> [startIndex]');
  process.exit(1);
}

const startIndex = Number.parseInt(startIndexRaw ?? '1', 10);
if (!Number.isInteger(startIndex) || startIndex < 1) {
  console.error('startIndex must be a positive integer.');
  process.exit(1);
}

const result = convertFile(inputPath, outputPath, startIndex);
console.log(
  JSON.stringify(
    {
      inputPath,
      outputPath,
      totalRows: result.totalRows,
      items: result.items,
      firstExternalId: `notion-${startIndex}`,
      lastExternalId: `notion-${result.nextId - 1}`,
    },
    null,
    2
  )
);
