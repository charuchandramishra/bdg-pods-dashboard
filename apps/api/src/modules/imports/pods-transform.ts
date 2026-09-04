import {
  ParsedSheet,
  PodInfoRecord,
  PodDailyRecord,
  PreviewRecord,
  ValidationIssue,
  mapPodHeader,
  mapHeaders,
  hasRequiredMappedField,
  normalizeKey,
  normalizeHeader,
  normalizePercentage,
  parseFlexibleDate,
} from '@bdg-pods/shared';

export interface PodsTransformResult {
  pods: PreviewRecord<PodInfoRecord>[];
  dailyUpdates: PreviewRecord<PodDailyRecord>[];
  validCount: number;
  warningCount: number;
  errorCount: number;
}

function findInfoSheet(sheets: ParsedSheet[]): ParsedSheet | null {
  const byName = sheets.find((s) => /info/i.test(s.name));
  if (byName) return byName;
  for (const sheet of sheets) {
    const mapping = mapHeaders(sheet.headers, mapPodHeader);
    if (hasRequiredMappedField(mapping, 'podName')) {
      return sheet;
    }
  }
  return null;
}

function findDailySheet(sheets: ParsedSheet[]): ParsedSheet | null {
  return (
    sheets.find((s) => /daily/i.test(s.name)) ??
    sheets.find((s) => /update/i.test(s.name)) ??
    null
  );
}

function validateCompletion(
  value: unknown,
  row: number,
  field: string,
  issues: ValidationIssue[],
): number | null {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const n = normalizePercentage(value);
  if (n === null) {
    issues.push({
      row,
      field,
      message: `Invalid completion percentage for ${field}: ${String(value)}`,
      severity: 'error',
    });
    return null;
  }
  if (n < 0 || n > 100) {
    issues.push({
      row,
      field,
      message: `Completion percentage must be between 0 and 100 (${field})`,
      severity: 'error',
    });
    return null;
  }
  return n;
}

export function transformPodsSheets(
  sheets: ParsedSheet[],
  existingNormalizedNames: Set<string> = new Set(),
): PodsTransformResult {
  const infoSheet = findInfoSheet(sheets);
  if (!infoSheet) {
    throw new Error(
      'Required column "POD Name" was not found. Please upload a PODS report with an Info sheet.',
    );
  }

  const mapping = mapHeaders(infoSheet.headers, mapPodHeader);
  if (!hasRequiredMappedField(mapping, 'podName')) {
    throw new Error(
      'Required column "POD Name" was not found in the Info sheet.',
    );
  }

  const pods: PreviewRecord<PodInfoRecord>[] = [];
  const dailyUpdates: PreviewRecord<PodDailyRecord>[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  const seenPods = new Set<string>();

  infoSheet.rows.forEach((row, index) => {
    const rowNum = index + 2;
    const issues: ValidationIssue[] = [];
    const get = (field: string): unknown => {
      const header = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return header ? row[header] : undefined;
    };

    const podName = String(get('podName') ?? '').trim();
    if (!podName) {
      // skip blank spacer rows common in PODS workbook
      const anyValue = Object.values(row).some(
        (v) => v !== null && v !== undefined && String(v).trim() !== '',
      );
      if (!anyValue) return;
      issues.push({
        row: rowNum,
        field: 'podName',
        message: 'POD Name is missing',
        severity: 'error',
      });
    }

    const startRaw = get('startDate');
    let startDate: string | null = null;
    if (startRaw !== null && startRaw !== undefined && String(startRaw).trim() !== '') {
      startDate = parseFlexibleDate(startRaw);
      if (!startDate) {
        issues.push({
          row: rowNum,
          field: 'startDate',
          message: `Invalid start date: ${String(startRaw)}`,
          severity: 'error',
        });
      }
    }

    const data: PodInfoRecord = {
      podName,
      description: String(get('description') ?? '').trim() || null,
      status: String(get('status') ?? '').trim() || null,
      startDate,
      developers: String(get('developers') ?? '').trim() || null,
      machineOwner: String(get('machineOwner') ?? '').trim() || null,
      machineAlignedToProject:
        String(get('machineAlignedToProject') ?? '').trim() || null,
      feCompletion: validateCompletion(get('feCompletion'), rowNum, 'FE', issues),
      beCompletion: validateCompletion(get('beCompletion'), rowNum, 'BE', issues),
      integrationCompletion: validateCompletion(
        get('integrationCompletion'),
        rowNum,
        'Integration',
        issues,
      ),
    };

    const normalized = normalizeKey(podName);
    if (podName && seenPods.has(normalized)) {
      issues.push({
        row: rowNum,
        field: 'podName',
        message: `Duplicate POD detected in file: "${podName}"`,
        severity: 'error',
      });
    }
    if (podName) seenPods.add(normalized);

    const hasError = issues.some((i) => i.severity === 'error');
    const hasWarning = issues.some((i) => i.severity === 'warning');
    if (hasError) errorCount += 1;
    else validCount += 1;
    if (hasWarning) warningCount += 1;

    pods.push({
      row: rowNum,
      data,
      action: hasError
        ? 'skip'
        : existingNormalizedNames.has(normalized)
          ? 'update'
          : 'create',
      issues,
    });
  });

  const dailySheet = findDailySheet(sheets);
  if (dailySheet) {
    const daily = transformDailyUpdateSheet(dailySheet);
    dailyUpdates.push(...daily.records);
    validCount += daily.validCount;
    warningCount += daily.warningCount;
    errorCount += daily.errorCount;
  }

  return { pods, dailyUpdates, validCount, warningCount, errorCount };
}

/**
 * PODS Daily Update sheet layout:
 * Row 1: date group headers spanning columns (e.g. "Completion Percentage - 01/09/2026")
 * Row 2: sub-headers POD Name | FE | BE | Integration | ... repeated per date
 * Data rows: POD name + completion triples per date block
 */
export function transformDailyUpdateSheet(sheet: ParsedSheet): {
  records: PreviewRecord<PodDailyRecord>[];
  validCount: number;
  warningCount: number;
  errorCount: number;
} {
  // Rebuild from raw header names — ExcelParser already used first multi-col row as header.
  // For Daily Update, the "headers" may be the second row (FE/BE/...) while dates are lost.
  // We also accept flat mapped rows if columns are already dated.

  const headers = sheet.headers;
  const dateBlocks = detectDateBlocks(headers);

  // Fallback: if no date blocks, treat as single-date rows with date column
  if (dateBlocks.length === 0) {
    return transformFlatDailyRows(sheet);
  }

  const records: PreviewRecord<PodDailyRecord>[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  sheet.rows.forEach((row, index) => {
    const rowNum = index + 2;
    const podHeader =
      headers.find((h) => mapPodHeader(h) === 'podName') ?? headers[0];
    const podName = String(row[podHeader] ?? '').trim();
    if (!podName) return;

    for (const block of dateBlocks) {
      const issues: ValidationIssue[] = [];
      const fe = validateCompletion(
        row[block.feHeader],
        rowNum,
        'FE',
        issues,
      );
      const be = validateCompletion(
        row[block.beHeader],
        rowNum,
        'BE',
        issues,
      );
      const integ = validateCompletion(
        row[block.intHeader],
        rowNum,
        'Integration',
        issues,
      );

      // Skip empty date blocks
      if (fe === null && be === null && integ === null && issues.length === 0) {
        continue;
      }

      const hasError = issues.some((i) => i.severity === 'error');
      if (hasError) errorCount += 1;
      else validCount += 1;
      if (issues.some((i) => i.severity === 'warning')) warningCount += 1;

      records.push({
        row: rowNum,
        data: {
          podName,
          date: block.date,
          feCompletion: fe,
          beCompletion: be,
          integrationCompletion: integ,
        },
        action: hasError ? 'skip' : 'update',
        issues,
      });
    }
  });

  return { records, validCount, warningCount, errorCount };
}

interface DateBlock {
  date: string;
  feHeader: string;
  beHeader: string;
  intHeader: string;
}

function detectDateBlocks(headers: string[]): DateBlock[] {
  // When ExcelParser uses row 2 as headers, we lose date row.
  // Detect repeating FE/BE/Integration triplets and assign dates from
  // any header that embeds a date, or sequential unknown dates.

  const blocks: DateBlock[] = [];
  let i = 0;
  while (i < headers.length) {
    const h = headers[i];
    const mapped = mapPodHeader(h);
    if (mapped === 'podName' || normalizeHeader(h).includes('pod')) {
      i += 1;
      continue;
    }

    // Look for FE starting a triplet
    if (mapped === 'feCompletion' || normalizeHeader(h) === 'fe') {
      const feHeader = headers[i];
      const beHeader = headers[i + 1];
      const intHeader = headers[i + 2];
      if (!beHeader || !intHeader) break;

      const dateFromHeader =
        extractDateFromHeader(feHeader) ||
        extractDateFromHeader(beHeader) ||
        extractDateFromHeader(intHeader);

      // If headers are just "FE", "BE", "FE + BE integrations" without dates,
      // we need dates from a separate source — handled by enhanced excel parse below.
      const date = dateFromHeader ?? `block-${blocks.length}`;
      if (date.startsWith('block-')) {
        // Without a date we cannot safely import — skip this block with no records
        i += 3;
        continue;
      }

      blocks.push({ date, feHeader, beHeader, intHeader });
      i += 3;
      continue;
    }

    // Header embeds date like "Completion Percentage - 01/09/2026"
    const embedded = extractDateFromHeader(h);
    if (embedded && i + 2 < headers.length) {
      blocks.push({
        date: embedded,
        feHeader: headers[i],
        beHeader: headers[i + 1],
        intHeader: headers[i + 2],
      });
      i += 3;
      continue;
    }

    i += 1;
  }

  return blocks;
}

function extractDateFromHeader(header: string): string | null {
  const m = header.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
  if (!m) return null;
  return parseFlexibleDate(m[1]);
}

function transformFlatDailyRows(sheet: ParsedSheet): {
  records: PreviewRecord<PodDailyRecord>[];
  validCount: number;
  warningCount: number;
  errorCount: number;
} {
  const mapping = mapHeaders(sheet.headers, mapPodHeader);
  const dateHeader =
    sheet.headers.find((h) => /date/i.test(h)) ?? null;

  const records: PreviewRecord<PodDailyRecord>[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  if (!hasRequiredMappedField(mapping, 'podName') || !dateHeader) {
    return { records, validCount, warningCount, errorCount };
  }

  sheet.rows.forEach((row, index) => {
    const rowNum = index + 2;
    const issues: ValidationIssue[] = [];
    const get = (field: string) => {
      const header = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return header ? row[header] : undefined;
    };
    const podName = String(get('podName') ?? '').trim();
    if (!podName) return;
    const date = parseFlexibleDate(row[dateHeader]);
    if (!date) {
      issues.push({
        row: rowNum,
        field: 'date',
        message: `Invalid date: ${String(row[dateHeader])}`,
        severity: 'error',
      });
    }
    const fe = validateCompletion(get('feCompletion'), rowNum, 'FE', issues);
    const be = validateCompletion(get('beCompletion'), rowNum, 'BE', issues);
    const integ = validateCompletion(
      get('integrationCompletion'),
      rowNum,
      'Integration',
      issues,
    );
    const hasError = issues.some((i) => i.severity === 'error') || !date;
    if (hasError) errorCount += 1;
    else validCount += 1;
    if (issues.some((i) => i.severity === 'warning')) warningCount += 1;

    records.push({
      row: rowNum,
      data: {
        podName,
        date: date ?? '',
        feCompletion: fe,
        beCompletion: be,
        integrationCompletion: integ,
      },
      action: hasError ? 'skip' : 'update',
      issues,
    });
  });

  return { records, validCount, warningCount, errorCount };
}

/**
 * Specialized parse for PODS Daily Update using raw workbook matrix
 * so we can read the date header row + metric header row together.
 */
export function transformDailyFromMatrix(
  matrix: (string | number | null)[][],
): {
  records: PreviewRecord<PodDailyRecord>[];
  validCount: number;
  warningCount: number;
  errorCount: number;
} {
  const records: PreviewRecord<PodDailyRecord>[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  if (matrix.length < 3) {
    return { records, validCount, warningCount, errorCount };
  }

  // Find date header row and metric header row
  let dateRowIdx = -1;
  let metricRowIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const row = matrix[i] ?? [];
    const joined = row.map((c) => String(c ?? '')).join(' ');
    if (/completion percentage/i.test(joined) || /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(joined)) {
      dateRowIdx = i;
    }
    if (/pod\s*name/i.test(joined) && /fe/i.test(joined)) {
      metricRowIdx = i;
    }
  }

  if (metricRowIdx < 0) {
    return { records, validCount, warningCount, errorCount };
  }

  const metricRow = (matrix[metricRowIdx] ?? []).map((c) =>
    c === null || c === undefined ? '' : String(c).trim(),
  );
  const dateRow =
    dateRowIdx >= 0
      ? (matrix[dateRowIdx] ?? []).map((c) =>
          c === null || c === undefined ? '' : String(c).trim(),
        )
      : [];

  // Build blocks: for each FE column, associate nearest date from date row
  const blocks: Array<{
    date: string;
    feCol: number;
    beCol: number;
    intCol: number;
  }> = [];

  for (let c = 0; c < metricRow.length; c++) {
    const mapped = mapPodHeader(metricRow[c]);
    if (mapped !== 'feCompletion' && normalizeHeader(metricRow[c]) !== 'fe') {
      continue;
    }
    // Find date for this column by looking leftward in date row
    let dateStr: string | null = null;
    for (let d = c; d >= 0; d--) {
      dateStr = extractDateFromHeader(dateRow[d] ?? '');
      if (dateStr) break;
    }
    if (!dateStr) continue;
    blocks.push({
      date: dateStr,
      feCol: c,
      beCol: c + 1,
      intCol: c + 2,
    });
  }

  const podCol = metricRow.findIndex(
    (h) => mapPodHeader(h) === 'podName' || normalizeHeader(h).includes('pod'),
  );
  const nameCol = podCol >= 0 ? podCol : 0;

  for (let r = metricRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const podName = String(row[nameCol] ?? '').trim();
    if (!podName) continue;

    for (const block of blocks) {
      const issues: ValidationIssue[] = [];
      const rowNum = r + 1;
      const fe = validateCompletion(row[block.feCol], rowNum, 'FE', issues);
      const be = validateCompletion(row[block.beCol], rowNum, 'BE', issues);
      const integ = validateCompletion(
        row[block.intCol],
        rowNum,
        'Integration',
        issues,
      );
      if (fe === null && be === null && integ === null && issues.length === 0) {
        continue;
      }
      const hasError = issues.some((i) => i.severity === 'error');
      if (hasError) errorCount += 1;
      else validCount += 1;
      if (issues.some((i) => i.severity === 'warning')) warningCount += 1;

      records.push({
        row: rowNum,
        data: {
          podName,
          date: block.date,
          feCompletion: fe,
          beCompletion: be,
          integrationCompletion: integ,
        },
        action: hasError ? 'skip' : 'update',
        issues,
      });
    }
  }

  return { records, validCount, warningCount, errorCount };
}
