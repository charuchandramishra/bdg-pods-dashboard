export type UserRole = 'ADMIN' | 'USER';

export type ReportModule = 'BDG' | 'PODS';

export type UploadStatus = 'PENDING' | 'PARSED' | 'FAILED';

export type ImportStatus =
  | 'PREVIEW'
  | 'COMMITTED'
  | 'FAILED'
  | 'CANCELLED';

export type FileFormat = 'CSV' | 'XLS' | 'XLSX' | 'DOC' | 'DOCX' | 'PDF';

export interface BdgRecord {
  memberName: string;
  totalInbound: number | null;
  totalOutbound: number | null;
  apacInbound: number | null;
  apacOutbound: number | null;
  menaInbound: number | null;
  menaOutbound: number | null;
  internationalInbound: number | null;
  internationalOutbound: number | null;
  ukeuInbound: number | null;
  ukeuOutbound: number | null;
  naInbound: number | null;
  naOutbound: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface PodInfoRecord {
  podName: string;
  description?: string | null;
  status?: string | null;
  startDate?: string | null;
  developers?: string | null;
  machineOwner?: string | null;
  machineAlignedToProject?: string | null;
  feCompletion?: number | null;
  beCompletion?: number | null;
  integrationCompletion?: number | null;
}

export interface PodDailyRecord {
  podName: string;
  date: string;
  feCompletion: number | null;
  beCompletion: number | null;
  integrationCompletion: number | null;
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ParseResult {
  format: FileFormat;
  sheets: ParsedSheet[];
  warnings: string[];
  rawText?: string;
}

export interface ValidationIssue {
  row: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface PreviewRecord<T> {
  row: number;
  data: T;
  action: 'create' | 'update' | 'skip';
  issues: ValidationIssue[];
}

export interface BdgPreviewPayload {
  module: 'BDG';
  periodStart?: string | null;
  periodEnd?: string | null;
  records: PreviewRecord<BdgRecord>[];
  validCount: number;
  warningCount: number;
  errorCount: number;
}

export interface PodsPreviewPayload {
  module: 'PODS';
  pods: PreviewRecord<PodInfoRecord>[];
  dailyUpdates: PreviewRecord<PodDailyRecord>[];
  validCount: number;
  warningCount: number;
  errorCount: number;
}

export type ImportPreviewPayload = BdgPreviewPayload | PodsPreviewPayload;

export interface DashboardSummary {
  totalBdgMembers: number;
  totalInboundLeads: number;
  totalOutboundLeads: number;
  totalLeads: number;
  totalPods: number;
  podsInProgress: number;
  podsCompleted: number;
  avgPodCompletion: number;
  avgFeCompletion: number;
  avgBeCompletion: number;
  avgIntegrationCompletion: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
