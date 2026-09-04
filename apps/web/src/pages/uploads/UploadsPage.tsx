import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { importsApi } from '../../services/endpoints';
import { PageHeader, ErrorState } from '../../components/Common';

type ModuleType = 'BDG' | 'PODS';

type PreviewRecord = {
  row?: number;
  action?: string;
  data?: Record<string, unknown>;
  issues?: Array<{ message: string }>;
};

function regionTotal(inbound: unknown, outbound: unknown) {
  const a = Number(inbound ?? 0);
  const b = Number(outbound ?? 0);
  return a + b;
}

function issuesText(issues: Array<{ message: string }> | undefined) {
  if (!issues?.length) return '—';
  return issues.map((i) => i.message).join('; ');
}

function ActionChip({ action }: { action: string }) {
  return (
    <Chip
      size="small"
      label={action}
      color={
        action === 'skip' ? 'default' : action === 'create' ? 'success' : 'info'
      }
    />
  );
}

export default function UploadsPage() {
  const navigate = useNavigate();
  const [module, setModule] = useState<ModuleType>('BDG');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    fileName: string;
    module: string;
  } | null>(null);
  const [commitResult, setCommitResult] = useState<Record<string, unknown> | null>(
    null,
  );

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const clearPreview = () => {
    setPreview(null);
    setPreviewMeta(null);
  };

  const runPreview = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }
    setBusy(true);
    setError('');
    setCommitResult(null);
    try {
      const result = await importsApi.preview(file, module);
      setPreview(result.preview);
      setPreviewMeta({
        fileName: result.fileName ?? file.name,
        module: result.module ?? module,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      clearPreview();
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) {
      setError('File is missing. Select the file again and preview.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await importsApi.commit(file, module);
      setCommitResult(result);
      clearPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const previewModule = (previewMeta?.module ?? preview?.module) as
    | string
    | undefined;
  const bdgRecords: PreviewRecord[] =
    previewModule === 'BDG'
      ? ((preview?.records as PreviewRecord[]) ?? [])
      : [];
  const podRecords: PreviewRecord[] =
    previewModule === 'PODS' ? ((preview?.pods as PreviewRecord[]) ?? []) : [];
  const dailyRecords: PreviewRecord[] =
    previewModule === 'PODS'
      ? ((preview?.dailyUpdates as PreviewRecord[]) ?? [])
      : [];

  const recordsDetected =
    previewModule === 'BDG'
      ? bdgRecords.length
      : podRecords.length + dailyRecords.length;

  return (
    <Box>
      <PageHeader
        title="Import Data"
        subtitle="Preview extracted records first. Nothing is saved until you confirm Import."
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              select
              label="Report type"
              value={module}
              onChange={(e) => setModule(e.target.value as ModuleType)}
              sx={{ maxWidth: 280 }}
            >
              <MenuItem value="BDG">BDG Report</MenuItem>
              <MenuItem value="PODS">PODS Report</MenuItem>
            </TextField>

            <Box
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              sx={{
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: dragOver ? 'rgba(11,61,92,0.04)' : 'background.paper',
              }}
            >
              <CloudUploadIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography gutterBottom>
                Drag and drop a file here, or choose a file
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Supported formats: CSV, XLS, XLSX, DOC, DOCX, PDF
              </Typography>
              <Button variant="outlined" component="label">
                Choose file
                <input
                  hidden
                  type="file"
                  accept=".csv,.xls,.xlsx,.doc,.docx,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Button>
              {file ? (
                <Typography sx={{ mt: 2 }} fontWeight={600}>
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </Typography>
              ) : null}
            </Box>

            {error ? <ErrorState message={error} /> : null}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={!file || busy}
                onClick={runPreview}
              >
                {busy && !preview ? 'Generating preview…' : 'Preview'}
              </Button>
              <Button variant="text" onClick={() => navigate('/imports')}>
                View import history
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Preview does not save anything. Import history only appears after you
              confirm Import Valid Records.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(preview)}
        onClose={() => !busy && clearPreview()}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Import Preview</DialogTitle>
        <DialogContent dividers>
          {preview ? (
            <Stack spacing={2}>
              <Typography>
                File: <strong>{previewMeta?.fileName ?? file?.name}</strong>
              </Typography>
              <Alert severity="warning">
                Nothing has been uploaded to the database yet. Cancel discards
                this preview. Import Valid Records saves the file and upserts data.
              </Alert>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Records detected: ${recordsDetected}`} />
                <Chip color="success" label={`Valid: ${String(preview.validCount)}`} />
                <Chip color="warning" label={`Warnings: ${String(preview.warningCount)}`} />
                <Chip color="error" label={`Errors: ${String(preview.errorCount)}`} />
              </Stack>

              {previewModule === 'BDG' ? (
                <TableContainer sx={{ maxHeight: 480 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Row</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>Member</TableCell>
                        <TableCell align="right">Inbound</TableCell>
                        <TableCell align="right">Outbound</TableCell>
                        <TableCell align="right">APAC</TableCell>
                        <TableCell align="right">MENA</TableCell>
                        <TableCell align="right">Intl</TableCell>
                        <TableCell align="right">UK/EU</TableCell>
                        <TableCell align="right">NA</TableCell>
                        <TableCell>Issues</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bdgRecords.map((r, idx) => {
                        const data = (r.data ?? {}) as Record<string, unknown>;
                        return (
                          <TableRow key={`${r.row}-${idx}`}>
                            <TableCell>{String(r.row ?? idx + 1)}</TableCell>
                            <TableCell>
                              <ActionChip action={String(r.action ?? '—')} />
                            </TableCell>
                            <TableCell>{String(data.memberName ?? '—')}</TableCell>
                            <TableCell align="right">
                              {String(data.totalInbound ?? 0)}
                            </TableCell>
                            <TableCell align="right">
                              {String(data.totalOutbound ?? 0)}
                            </TableCell>
                            <TableCell align="right">
                              {regionTotal(data.apacInbound, data.apacOutbound)}
                            </TableCell>
                            <TableCell align="right">
                              {regionTotal(data.menaInbound, data.menaOutbound)}
                            </TableCell>
                            <TableCell align="right">
                              {regionTotal(
                                data.internationalInbound,
                                data.internationalOutbound,
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {regionTotal(data.ukeuInbound, data.ukeuOutbound)}
                            </TableCell>
                            <TableCell align="right">
                              {regionTotal(data.naInbound, data.naOutbound)}
                            </TableCell>
                            <TableCell>{issuesText(r.issues)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {bdgRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11}>No BDG records found</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : null}

              {previewModule === 'PODS' ? (
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      POD Info
                    </Typography>
                    <TableContainer sx={{ maxHeight: 480 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Row</TableCell>
                            <TableCell>Action</TableCell>
                            <TableCell>POD Name</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Start Date</TableCell>
                            <TableCell>Developers</TableCell>
                            <TableCell>Machine Owner</TableCell>
                            <TableCell>Machine</TableCell>
                            <TableCell align="right">FE %</TableCell>
                            <TableCell align="right">BE %</TableCell>
                            <TableCell align="right">Integration %</TableCell>
                            <TableCell>Issues</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {podRecords.map((r, idx) => {
                            const data = (r.data ?? {}) as Record<string, unknown>;
                            return (
                              <TableRow key={`pod-${r.row}-${idx}`}>
                                <TableCell>{String(r.row ?? idx + 1)}</TableCell>
                                <TableCell>
                                  <ActionChip action={String(r.action ?? '—')} />
                                </TableCell>
                                <TableCell>{String(data.podName ?? '—')}</TableCell>
                                <TableCell>{String(data.description ?? '—')}</TableCell>
                                <TableCell>{String(data.status ?? '—')}</TableCell>
                                <TableCell>
                                  {data.startDate
                                    ? String(data.startDate).slice(0, 10)
                                    : '—'}
                                </TableCell>
                                <TableCell>{String(data.developers ?? '—')}</TableCell>
                                <TableCell>{String(data.machineOwner ?? '—')}</TableCell>
                                <TableCell>
                                  {String(data.machineAlignedToProject ?? '—')}
                                </TableCell>
                                <TableCell align="right">
                                  {String(data.feCompletion ?? '—')}
                                </TableCell>
                                <TableCell align="right">
                                  {String(data.beCompletion ?? '—')}
                                </TableCell>
                                <TableCell align="right">
                                  {String(data.integrationCompletion ?? '—')}
                                </TableCell>
                                <TableCell>{issuesText(r.issues)}</TableCell>
                              </TableRow>
                            );
                          })}
                          {podRecords.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={13}>No POD info records found</TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  <Box>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Daily Updates
                    </Typography>
                    <TableContainer sx={{ maxHeight: 480 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>POD Name</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">FE</TableCell>
                            <TableCell align="right">BE</TableCell>
                            <TableCell align="right">Integration</TableCell>
                            <TableCell>Action</TableCell>
                            <TableCell>Issues</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dailyRecords.map((r, idx) => {
                            const data = (r.data ?? {}) as Record<string, unknown>;
                            return (
                              <TableRow key={`daily-${r.row}-${idx}`}>
                                <TableCell>{String(data.podName ?? '—')}</TableCell>
                                <TableCell>
                                  {data.date ? String(data.date).slice(0, 10) : '—'}
                                </TableCell>
                                <TableCell align="right">
                                  {String(data.feCompletion ?? '—')}
                                </TableCell>
                                <TableCell align="right">
                                  {String(data.beCompletion ?? '—')}
                                </TableCell>
                                <TableCell align="right">
                                  {String(data.integrationCompletion ?? '—')}
                                </TableCell>
                                <TableCell>
                                  <ActionChip action={String(r.action ?? '—')} />
                                </TableCell>
                                <TableCell>{issuesText(r.issues)}</TableCell>
                              </TableRow>
                            );
                          })}
                          {dailyRecords.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7}>No daily update records found</TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={clearPreview} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={commit}
            disabled={busy || Number(preview?.validCount ?? 0) === 0}
          >
            {busy ? 'Importing…' : 'Import Valid Records'}
          </Button>
        </DialogActions>
      </Dialog>

      {commitResult ? (
        <Alert severity="success" sx={{ mt: 2 }}>
          Import completed: {String(commitResult.summary ?? 'Success')}.{' '}
          <Button size="small" onClick={() => navigate('/imports')}>
            View history
          </Button>
        </Alert>
      ) : null}
    </Box>
  );
}
