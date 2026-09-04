import pdfParse from 'pdf-parse';
import { FileFormat, ParseResult, ParsedSheet } from '@bdg-pods/shared';
import { FileParser } from './file-parser.interface';

/**
 * PDF parser: extracts text and attempts table reconstruction.
 * Never silently invents columns — returns empty sheets with clear warnings
 * when structure cannot be identified.
 */
export class PdfParser implements FileParser {
  readonly formats: FileFormat[] = ['PDF'];

  canParse(format: FileFormat): boolean {
    return format === 'PDF';
  }

  async parse(buffer: Buffer, fileName: string): Promise<ParseResult> {
    const warnings: string[] = [];
    let rawText = '';

    try {
      const result = await pdfParse(buffer);
      rawText = result.text ?? '';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF parse failed';
      throw new Error(
        `Unable to reliably identify the required BDG/PODS table. ${message}. Please upload a structured Excel, CSV, Word or machine-readable PDF.`,
      );
    }

    if (!rawText.trim()) {
      throw new Error(
        'Unable to reliably identify the required BDG/PODS table. Please upload a structured Excel, CSV, Word or machine-readable PDF.',
      );
    }

    const sheets = this.extractTablesFromText(rawText, fileName, warnings);

    if (sheets.length === 0) {
      throw new Error(
        'Unable to reliably identify the required BDG/PODS table. Please upload a structured Excel, CSV, Word or machine-readable PDF.',
      );
    }

    return {
      format: 'PDF',
      sheets,
      warnings,
      rawText: rawText.slice(0, 10000),
    };
  }

  private extractTablesFromText(
    text: string,
    fileName: string,
    warnings: string[],
  ): ParsedSheet[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+$/g, ''))
      .filter((l) => l.trim().length > 0);

    // Strategy 1: lines with multiple columns separated by 2+ spaces or tabs
    const candidateRows = lines
      .map((line) => {
        if (line.includes('\t')) {
          return line.split('\t').map((c) => c.trim());
        }
        return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
      })
      .filter((cells) => cells.length >= 2);

    if (candidateRows.length < 2) {
      warnings.push('PDF text did not contain multi-column table structure.');
      return [];
    }

    // Find a header-looking row that mentions member/pod
    let headerIndex = 0;
    for (let i = 0; i < Math.min(candidateRows.length, 20); i++) {
      const joined = candidateRows[i].join(' ').toLowerCase();
      if (
        joined.includes('bdg member') ||
        joined.includes('member') ||
        joined.includes('pod name') ||
        joined.includes('pod')
      ) {
        headerIndex = i;
        break;
      }
    }

    const headers = candidateRows[headerIndex];
    const colCount = headers.length;
    const consistent = candidateRows
      .slice(headerIndex + 1)
      .filter((r) => Math.abs(r.length - colCount) <= 2);

    if (consistent.length === 0) {
      warnings.push('PDF table columns were inconsistent across rows.');
      return [];
    }

    const rows: Record<string, unknown>[] = consistent.map((cells) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i] || `Column_${i + 1}`] = cells[i] ?? '';
      }
      return obj;
    });

    return [
      {
        name: fileName.replace(/\.[^.]+$/, '') || 'PDF',
        headers: headers.map((h, i) => h || `Column_${i + 1}`),
        rows,
      },
    ];
  }
}
