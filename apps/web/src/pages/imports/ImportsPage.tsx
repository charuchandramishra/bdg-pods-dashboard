import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import { importsApi } from '../../services/endpoints';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../../components/Common';

export default function ImportsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    importsApi
      .list(page + 1)
      .then((res) => {
        setRows(res.data);
        setTotal(res.total);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <Box>
      <PageHeader
        title="Import History"
        subtitle="Track previewed and committed imports"
      />
      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No imports yet" description="Upload a report to create an import job." />
          ) : (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell align="right">Records Found</TableCell>
                    <TableCell align="right">Created</TableCell>
                    <TableCell align="right">Updated</TableCell>
                    <TableCell align="right">Errors</TableCell>
                    <TableCell>Uploaded By</TableCell>
                    <TableCell>Uploaded At</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const upload = row.upload as Record<string, unknown> | undefined;
                    const committedBy = row.committedBy as
                      | Record<string, unknown>
                      | undefined
                      | null;
                    return (
                      <TableRow key={String(row.id)} hover>
                        <TableCell>
                          <Link component={RouterLink} to={`/imports/${row.id}`}>
                            {String(upload?.originalName ?? '—')}
                          </Link>
                        </TableCell>
                        <TableCell>{String(upload?.format ?? '—')}</TableCell>
                        <TableCell>{String(row.module)}</TableCell>
                        <TableCell align="right">{String(row.recordsFound)}</TableCell>
                        <TableCell align="right">{String(row.recordsCreated)}</TableCell>
                        <TableCell align="right">{String(row.recordsUpdated)}</TableCell>
                        <TableCell align="right">{String(row.errorCount)}</TableCell>
                        <TableCell>
                          {String(
                            committedBy?.name ??
                              (upload?.uploadedBy as { name?: string } | undefined)?.name ??
                              '—',
                          )}
                        </TableCell>
                        <TableCell>
                          {row.createdAt
                            ? new Date(String(row.createdAt)).toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={String(row.status)}
                            color={
                              row.status === 'COMMITTED'
                                ? 'success'
                                : row.status === 'FAILED'
                                  ? 'error'
                                  : 'default'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={20}
                rowsPerPageOptions={[20]}
              />
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    importsApi
      .get(id)
      .then(setJob)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!job) return <EmptyState title="Import not found" />;

  const upload = job.upload as Record<string, unknown> | undefined;
  const preview = job.previewPayload as Record<string, unknown> | null;

  return (
    <Box>
      <PageHeader
        title={`Import: ${String(upload?.originalName ?? id)}`}
        subtitle={String(job.summary ?? job.status)}
      />
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2">Module: {String(job.module)}</Typography>
          <Typography variant="body2">Status: {String(job.status)}</Typography>
          <Typography variant="body2">
            Created: {String(job.recordsCreated)} · Updated: {String(job.recordsUpdated)} ·
            Errors: {String(job.errorCount)}
          </Typography>
          <Typography variant="body2">
            At:{' '}
            {job.createdAt ? new Date(String(job.createdAt)).toLocaleString() : '—'}
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Preview payload
          </Typography>
          <Box
            component="pre"
            sx={{
              overflow: 'auto',
              maxHeight: 480,
              bgcolor: '#0B3D5C',
              color: '#E8EEF3',
              p: 2,
              borderRadius: 1,
              fontSize: 12,
            }}
          >
            {JSON.stringify(preview, null, 2)}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
