import * as XLSX from 'xlsx';
import { FileFormat, ParseResult, ParsedSheet } from '@bdg-pods/shared';
import { FileParser } from './file-parser.interface';

export class ExcelParser implements FileParser {
  readonly formats: FileFormat[] = ['XLS', 'XLSX'];

  canParse(format: FileFormat): boolean {
    return format === 'XLS' || format === 'XLSX';
  }

  async parse(buffer: Buffer, _fileName: string): Promise<ParseResult> {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      raw: false,
    });

    const sheets: ParsedSheet[] = [];
    const warnings: string[] = [];

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;

      // Preserve raw values for percentage/date handling by reading twice
      const rowsAsArrays = XLSX.utils.sheet_to_json<(string | number | null)[]>(
        sheet,
        {
          header: 1,
          defval: null,
          raw: true,
          blankrows: false,
        },
      );

      if (rowsAsArrays.length === 0) {
        warnings.push(`Sheet "${name}" is empty`);
        continue;
      }

      // Find header row: first non-empty row with >= 2 string-like cells
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rowsAsArrays.length, 10); i++) {
        const row = rowsAsArrays[i] ?? [];
        const nonEmpty = row.filter(
          (c) => c !== null && c !== undefined && String(c).trim() !== '',
        );
        if (nonEmpty.length >= 2) {
          headerRowIndex = i;
          break;
        }
      }

      const headerRow = rowsAsArrays[headerRowIndex] ?? [];
      const headers = headerRow.map((h, idx) => {
        const label = h === null || h === undefined ? '' : String(h).trim();
        return label || `Column_${idx + 1}`;
      });

      const dataRows: Record<string, unknown>[] = [];
      for (let i = headerRowIndex + 1; i < rowsAsArrays.length; i++) {
        const raw = rowsAsArrays[i] ?? [];
        const obj: Record<string, unknown> = {};
        let hasValue = false;
        for (let c = 0; c < headers.length; c++) {
          const header = headers[c];
          const value = raw[c] ?? null;
          obj[header] = value;
          if (value !== null && value !== undefined && String(value).trim() !== '') {
            hasValue = true;
          }
        }
        if (hasValue) {
          dataRows.push(obj);
        }
      }

      sheets.push({ name, headers, rows: dataRows });
    }

    const format: FileFormat = 'XLSX';
    return { format, sheets, warnings };
  }
}
