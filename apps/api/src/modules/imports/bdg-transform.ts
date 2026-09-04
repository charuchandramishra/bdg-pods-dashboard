import {
  BdgRecord,
  ParsedSheet,
  PreviewRecord,
  ValidationIssue,
  mapBdgHeader,
  mapHeaders,
  hasRequiredMappedField,
  normalizeKey,
  isAggregateMemberName,
  parseNullableNumber,
  parseFlexibleDate,
} from '@bdg-pods/shared';

export interface BdgTransformResult {
  periodStart: string | null;
  periodEnd: string | null;
  records: PreviewRecord<BdgRecord>[];
  validCount: number;
  warningCount: number;
  errorCount: number;
}

const PERIOD_REGEX =
  /(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})\s+to\s+(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i;

function parsePeriodFromText(text?: string): {
  start: string | null;
  end: string | null;
} {
  if (!text) return { start: null, end: null };
  const match = text.match(PERIOD_REGEX);
  if (!match) return { start: null, end: null };
  const start = parseFlexibleDate(match[1].replace(/(st|nd|rd|th)/gi, ''));
  const end = parseFlexibleDate(match[2].replace(/(st|nd|rd|th)/gi, ''));
  return { start, end };
}

function findBdgSheet(sheets: ParsedSheet[]): ParsedSheet | null {
  for (const sheet of sheets) {
    const mapping = mapHeaders(sheet.headers, mapBdgHeader);
    if (hasRequiredMappedField(mapping, 'memberName')) {
      return sheet;
    }
  }
  // Try any sheet whose headers look like BDG when joined
  for (const sheet of sheets) {
    const joined = sheet.headers.join(' ').toLowerCase();
    if (joined.includes('bdg') || joined.includes('member')) {
      return sheet;
    }
  }
  return sheets[0] ?? null;
}

export function transformBdgSheets(
  sheets: ParsedSheet[],
  rawText?: string,
  existingNormalizedNames: Set<string> = new Set(),
): BdgTransformResult {
  const sheet = findBdgSheet(sheets);
  if (!sheet) {
    throw new Error(
      'Required column "BDG Member" was not found. Please upload a BDG report with recognizable columns.',
    );
  }

  const mapping = mapHeaders(sheet.headers, mapBdgHeader);
  if (!hasRequiredMappedField(mapping, 'memberName')) {
    throw new Error(
      'Required column "BDG Member" was not found. Please upload a BDG report with recognizable columns.',
    );
  }

  const period = parsePeriodFromText(rawText);
  const seen = new Set<string>();
  const records: PreviewRecord<BdgRecord>[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  sheet.rows.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1
    const issues: ValidationIssue[] = [];
    const get = (field: string): unknown => {
      const header = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return header ? row[header] : undefined;
    };

    const memberRaw = get('memberName');
    let memberName =
      memberRaw === null || memberRaw === undefined
        ? ''
        : String(memberRaw).trim();

    // Skip completely empty spacer rows
    const anyValue = Object.values(row).some(
      (v) => v !== null && v !== undefined && String(v).trim() !== '',
    );
    if (!anyValue) return;

    // Never import aggregate "Total" rows as BDG members
    if (memberName && isAggregateMemberName(memberName)) {
      return;
    }

    // Numeric-only member is likely a mis-mapped "#" index column with no leads
    if (/^\d+$/.test(memberName)) {
      const maybeInbound = parseNullableNumber(get('totalInbound'));
      const maybeOutbound = parseNullableNumber(get('totalOutbound'));
      if (maybeInbound === null && maybeOutbound === null) {
        return;
      }
    }

    if (!memberName) {
      issues.push({
        row: rowNum,
        field: 'memberName',
        message: 'BDG Member is missing',
        severity: 'error',
      });
    }

    const numericFields = [
      'totalInbound',
      'totalOutbound',
      'apacInbound',
      'apacOutbound',
      'menaInbound',
      'menaOutbound',
      'internationalInbound',
      'internationalOutbound',
      'ukeuInbound',
      'ukeuOutbound',
      'naInbound',
      'naOutbound',
    ] as const;

    const data: BdgRecord = {
      memberName,
      totalInbound: null,
      totalOutbound: null,
      apacInbound: null,
      apacOutbound: null,
      menaInbound: null,
      menaOutbound: null,
      internationalInbound: null,
      internationalOutbound: null,
      ukeuInbound: null,
      ukeuOutbound: null,
      naInbound: null,
      naOutbound: null,
      periodStart: period.start,
      periodEnd: period.end,
    };

    for (const field of numericFields) {
      const raw = get(field);
      if (raw === null || raw === undefined || String(raw).trim() === '') {
        data[field] = null;
        continue;
      }
      const n = parseNullableNumber(raw);
      if (n === null) {
        issues.push({
          row: rowNum,
          field,
          message: `Invalid number for ${field}: ${String(raw)}`,
          severity: 'error',
        });
        data[field] = null;
      } else if (n < 0) {
        issues.push({
          row: rowNum,
          field,
          message: `Lead values cannot be negative (${field})`,
          severity: 'error',
        });
        data[field] = null;
      } else {
        data[field] = Math.round(n);
      }
    }

    const normalized = normalizeKey(memberName);
    if (memberName && seen.has(normalized)) {
      issues.push({
        row: rowNum,
        field: 'memberName',
        message: `Duplicate BDG member detected in file: "${memberName}"`,
        severity: 'error',
      });
    }
    if (memberName) seen.add(normalized);

    const hasError = issues.some((i) => i.severity === 'error');
    const hasWarning = issues.some((i) => i.severity === 'warning');
    if (hasError) errorCount += 1;
    else validCount += 1;
    if (hasWarning) warningCount += 1;

    const action: 'create' | 'update' | 'skip' = hasError
      ? 'skip'
      : existingNormalizedNames.has(normalized)
        ? 'update'
        : 'create';

    records.push({ row: rowNum, data, action, issues });
  });

  return {
    periodStart: period.start,
    periodEnd: period.end,
    records,
    validCount,
    warningCount,
    errorCount,
  };
}
