import { FileFormat, ParseResult } from '@bdg-pods/shared';

export interface FileParser {
  readonly formats: FileFormat[];
  canParse(format: FileFormat, mimeType: string): boolean;
  parse(buffer: Buffer, fileName: string): Promise<ParseResult>;
}

export function detectFormat(
  fileName: string,
  mimeType: string,
): FileFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const mime = mimeType.toLowerCase();

  if (ext === 'csv' || mime.includes('csv') || mime === 'text/plain') {
    return 'CSV';
  }
  if (ext === 'xlsx' || mime.includes('spreadsheetml')) {
    return 'XLSX';
  }
  if (ext === 'xls' || mime.includes('ms-excel')) {
    return 'XLS';
  }
  if (ext === 'docx' || mime.includes('wordprocessingml')) {
    return 'DOCX';
  }
  if (ext === 'doc' || mime === 'application/msword') {
    return 'DOC';
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return 'PDF';
  }
  return null;
}

export const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'application/octet-stream',
]);

export const ALLOWED_EXTENSIONS = new Set([
  'csv',
  'xls',
  'xlsx',
  'doc',
  'docx',
  'pdf',
]);
