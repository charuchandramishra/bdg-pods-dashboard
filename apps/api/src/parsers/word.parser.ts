import * as mammoth from 'mammoth';
import { FileFormat, ParseResult, ParsedSheet } from '@bdg-pods/shared';
import { FileParser } from './file-parser.interface';

/**
 * Extracts tables from DOCX HTML output produced by mammoth.
 * Also falls back to line-based text parsing when no tables are found.
 */
export class WordParser implements FileParser {
  readonly formats: FileFormat[] = ['DOC', 'DOCX'];

  canParse(format: FileFormat): boolean {
    return format === 'DOC' || format === 'DOCX';
  }

  async parse(buffer: Buffer, fileName: string): Promise<ParseResult> {
    const warnings: string[] = [];

    // DOC (legacy) is not well supported by mammoth — try and surface clear error
    const isLegacyDoc = fileName.toLowerCase().endsWith('.doc');
    if (isLegacyDoc) {
      warnings.push(
        'Legacy .doc format has limited support. Prefer .docx for reliable table extraction.',
      );
    }

    let html = '';
    let rawText = '';
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      html = htmlResult.value;
      warnings.push(
        ...htmlResult.messages.map((m) => `Word: ${m.message}`),
      );
      const textResult = await mammoth.extractRawText({ buffer });
      rawText = textResult.value;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to parse Word document';
      throw new Error(
        `Unable to parse Word document. ${message}. Please upload DOCX, Excel, or CSV.`,
      );
    }

    const sheets = this.extractTablesFromHtml(html);
    if (sheets.length === 0) {
      const fallback = this.extractFromPlainText(rawText, fileName);
      if (fallback) {
        sheets.push(fallback);
        warnings.push(
          'No HTML tables detected; used plain-text heuristic extraction.',
        );
      } else {
        warnings.push('No tables found in Word document.');
      }
    }

    return {
      format: isLegacyDoc ? 'DOC' : 'DOCX',
      sheets,
      warnings,
      rawText: rawText.slice(0, 8000),
    };
  }

  private extractTablesFromHtml(html: string): ParsedSheet[] {
    const sheets: ParsedSheet[] = [];
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let match: RegExpExecArray | null;
    let tableIndex = 0;

    while ((match = tableRegex.exec(html)) !== null) {
      tableIndex += 1;
      const tableHtml = match[1];
      const rowsHtml = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      const matrix: string[][] = [];

      for (const rowMatch of rowsHtml) {
        const cells = [
          ...rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi),
        ].map((c) =>
          c[1]
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/\s+/g, ' ')
            .trim(),
        );
        if (cells.some((c) => c.length > 0)) {
          matrix.push(cells);
        }
      }

      if (matrix.length < 2) continue;

      const headers = matrix[0].map((h, i) => h || `Column_${i + 1}`);
      const rows: Record<string, unknown>[] = [];
      for (let r = 1; r < matrix.length; r++) {
        const row = matrix[r];
        const obj: Record<string, unknown> = {};
        for (let c = 0; c < headers.length; c++) {
          obj[headers[c]] = row[c] ?? '';
        }
        rows.push(obj);
      }

      sheets.push({
        name: `Table ${tableIndex}`,
        headers,
        rows,
      });
    }

    return sheets;
  }

  private extractFromPlainText(
    text: string,
    fileName: string,
  ): ParsedSheet | null {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return null;

    // Prefer tab-separated or multi-space separated lines
    const splitLine = (line: string) =>
      line.includes('\t')
        ? line.split('\t').map((c) => c.trim())
        : line.split(/\s{2,}/).map((c) => c.trim());

    const headers = splitLine(lines[0]);
    if (headers.length < 2) return null;

    const rows: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitLine(lines[i]);
      if (cells.length === 0) continue;
      const obj: Record<string, unknown> = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = cells[c] ?? '';
      }
      rows.push(obj);
    }

    return {
      name: fileName.replace(/\.[^.]+$/, '') || 'Document',
      headers,
      rows,
    };
  }
}
