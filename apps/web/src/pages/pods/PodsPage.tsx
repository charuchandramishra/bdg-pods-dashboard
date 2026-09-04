import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Link,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { podsApi } from '../../services/endpoints';
import {
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingState,
  PageHeader,
} from '../../components/Common';

const PIE_COLORS = ['#0B3D5C', '#1A5F86', '#C45C26', '#2E7D4F', '#B86E00', '#5B6B7A'];

const POD_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Blocked'];

const emptyForm = {
  name: '',
  description: '',
  status: 'Not Started',
  startDate: '',
  developers: '',
  machineOwner: '',
  machineAlignedToProject: '',
  feCompletion: 0,
  beCompletion: 0,
  integrationCompletion: 0,
};

export default function PodsPage() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [status, setStatus] = useState<Array<{ status: string; count: number }>>([]);
  const [completion, setCompletion] = useState<Array<Record<string, unknown>>>([]);
  const [allPods, setAllPods] = useState<Array<Record<string, unknown>>>([]);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [topN, setTopN] = useState(10);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPodIds, setSelectedPodIds] = useState<string[]>([]);
  const [historyPodId, setHistoryPodId] = useState('');
  const [historyRange, setHistoryRange] = useState<'all' | 'daily' | 'weekly' | 'custom'>(
    'all',
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const statusesParam = selectedStatuses.length ? selectedStatuses.join(',') : undefined;
  const idsParam = selectedPodIds.length ? selectedPodIds.join(',') : undefined;

  const statusOptions = useMemo(() => {
    const fromPods = allPods
      .map((p) => String(p.status ?? '').trim())
      .filter(Boolean);
    return [...new Set([...POD_STATUSES, ...fromPods])];
  }, [allPods]);

  const query = useMemo(
    () => ({
      page: page + 1,
      pageSize,
      search: search || undefined,
      status: statusFilter || undefined,
      sortBy,
      sortDir,
    }),
    [page, pageSize, search, statusFilter, sortBy, sortDir],
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      podsApi.summary(),
      podsApi.status(statusesParam ? { statuses: statusesParam } : undefined),
      podsApi.completion(topN, {
        ...(statusesParam ? { statuses: statusesParam } : {}),
        ...(idsParam ? { ids: idsParam } : {}),
      }),
      podsApi.list(query),
      podsApi.list({ page: 1, pageSize: 1000 }),
    ])
      .then(([s, st, c, list, all]) => {
        setSummary(s);
        setStatus(st);
        setCompletion(c);
        setRows(list.data);
        setTotal(list.total);
        setAllPods(all.data as Array<Record<string, unknown>>);
        if (!historyPodId && list.data[0]?.id) {
          setHistoryPodId(String(list.data[0].id));
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, topN, statusesParam, idsParam, reloadKey]);

  useEffect(() => {
    if (!historyPodId) return;
    podsApi
      .history(historyPodId, {
        range: historyRange,
        ...(historyRange === 'custom'
          ? {
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
            }
          : {}),
      })
      .then((res) => setHistory(res.history ?? []))
      .catch(() => setHistory([]));
  }, [historyPodId, historyRange, dateFrom, dateTo, reloadKey]);

  const download = async (format: 'csv' | 'xlsx') => {
    const url = podsApi.exportUrl(format, {
      search: search || '',
      status: statusFilter || '',
    });
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pods-export.${format === 'csv' ? 'csv' : 'xlsx'}`;
    a.click();
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setEditOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditId(String(row.id));
    setForm({
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      status: String(row.status ?? 'Not Started'),
      startDate: row.startDate ? String(row.startDate).slice(0, 10) : '',
      developers: String(row.developers ?? ''),
      machineOwner: String(row.machineOwner ?? ''),
      machineAlignedToProject: String(row.machineAlignedToProject ?? ''),
      feCompletion: Number(row.feCompletion ?? 0),
      beCompletion: Number(row.beCompletion ?? 0),
      integrationCompletion: Number(row.integrationCompletion ?? 0),
    });
    setEditOpen(true);
  };

  const savePod = async () => {
    setBusy(true);
    setError('');
    try {
      const body = {
        ...form,
        startDate: form.startDate || null,
        description: form.description || null,
        developers: form.developers || null,
        machineOwner: form.machineOwner || null,
        machineAlignedToProject: form.machineAlignedToProject || null,
      };
      if (editId) await podsApi.update(editId, body);
      else await podsApi.create(body);
      setEditOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const deletePod = async (id: string, name: string) => {
    if (!window.confirm(`Delete POD "${name}"?`)) return;
    try {
      await podsApi.remove(id);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading && !summary) return <LoadingState />;
  if (error && !summary) return <ErrorState message={error} />;
  if (!summary) {
    return <EmptyState title="No PODS data" description="Upload a PODS report to begin." />;
  }

  const historyChart = history.map((h) => ({
    date: String(h.date).slice(0, 10),
    FE: h.feCompletion,
    BE: h.beCompletion,
    Integration: h.integrationCompletion,
  }));

  const podOptions = allPods.length ? allPods : rows;

  return (
    <Box>
      <PageHeader
        title="PODS Dashboard"
        subtitle="Completion tracking across PODs"
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => download('csv')}>
              Export CSV
            </Button>
            <Button variant="outlined" onClick={() => download('xlsx')}>
              Export Excel
            </Button>
            <Button variant="contained" onClick={openCreate}>
              Add POD
            </Button>
          </Stack>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          ['Total PODs', summary.totalPods],
          ['In Progress', summary.inProgress],
          ['Completed', summary.completed],
          ['Not Started', summary.notStarted],
          ['Average FE %', `${summary.avgFeCompletion}%`],
          ['Average BE %', `${summary.avgBeCompletion}%`],
          ['Average Integration %', `${summary.avgIntegrationCompletion}%`],
          ['Overall Average %', `${summary.overallAverageCompletion}%`],
        ].map(([label, value]) => (
          <Grid item xs={12} sm={6} md={3} key={String(label)}>
            <KpiCard label={String(label)} value={value as string | number} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography variant="h6">PODs by Status</Typography>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Status filter</InputLabel>
                  <Select
                    multiple
                    value={selectedStatuses}
                    onChange={(e) =>
                      setSelectedStatuses(
                        typeof e.target.value === 'string'
                          ? e.target.value.split(',')
                          : e.target.value,
                      )
                    }
                    input={<OutlinedInput label="Status filter" />}
                    renderValue={(selected) =>
                      selected.length ? `${selected.length} selected` : 'All'
                    }
                  >
                    {statusOptions.map((s) => (
                      <MenuItem key={s} value={s}>
                        <Checkbox checked={selectedStatuses.includes(s)} />
                        <ListItemText primary={s} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={status}
                    dataKey="count"
                    nameKey="status"
                    outerRadius={90}
                    label
                  >
                    {status.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Completion by POD</Typography>
                <TextField
                  select
                  size="small"
                  label="Top N"
                  value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                  sx={{ width: 100 }}
                >
                  {[5, 10, 15, 20, 30].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={completion} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={110} />
                  <Tooltip />
                  <Bar dataKey="overallCompletion" fill="#0B3D5C" name="Overall %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6">FE vs BE vs Integration</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    select
                    size="small"
                    label="Top N"
                    value={topN}
                    onChange={(e) => setTopN(Number(e.target.value))}
                    sx={{ width: 100 }}
                  >
                    {[5, 10, 15, 20, 30].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </TextField>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>PODs</InputLabel>
                    <Select
                      multiple
                      value={selectedPodIds}
                      onChange={(e) =>
                        setSelectedPodIds(
                          typeof e.target.value === 'string'
                            ? e.target.value.split(',')
                            : e.target.value,
                        )
                      }
                      input={<OutlinedInput label="PODs" />}
                      renderValue={(selected) =>
                        selected.length ? `${selected.length} selected` : 'All PODs'
                      }
                    >
                      {podOptions.map((p) => (
                        <MenuItem key={String(p.id)} value={String(p.id)}>
                          <Checkbox checked={selectedPodIds.includes(String(p.id))} />
                          <ListItemText primary={String(p.name)} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button size="small" onClick={() => setSelectedPodIds([])}>
                    Clear
                  </Button>
                </Stack>
              </Stack>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={completion}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="feCompletion" fill="#0B3D5C" name="FE %" />
                  <Bar dataKey="beCompletion" fill="#C45C26" name="BE %" />
                  <Bar dataKey="integrationCompletion" fill="#2E7D4F" name="Integration %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{ mb: 2 }}
                alignItems={{ md: 'center' }}
              >
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  POD Progress Over Time
                </Typography>
                <TextField
                  select
                  size="small"
                  label="Select POD"
                  value={historyPodId}
                  onChange={(e) => setHistoryPodId(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  {podOptions.map((r) => (
                    <MenuItem key={String(r.id)} value={String(r.id)}>
                      {String(r.name)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Date range"
                  value={historyRange}
                  onChange={(e) =>
                    setHistoryRange(e.target.value as 'all' | 'daily' | 'weekly' | 'custom')
                  }
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </TextField>
                {historyRange === 'custom' ? (
                  <>
                    <TextField
                      size="small"
                      label="From"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      size="small"
                      label="To"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </>
                ) : null}
              </Stack>
              {historyChart.length === 0 ? (
                <EmptyState title="No daily updates for this POD" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={historyChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="FE" stroke="#0B3D5C" strokeWidth={2} />
                    <Line type="monotone" dataKey="BE" stroke="#C45C26" strokeWidth={2} />
                    <Line
                      type="monotone"
                      dataKey="Integration"
                      stroke="#2E7D4F"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ mb: 2 }}
            alignItems={{ md: 'center' }}
          >
            <TextField
              label="Search POD"
              size="small"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              sx={{ minWidth: 220 }}
            />
            <TextField
              select
              label="Status"
              size="small"
              value={statusFilter}
              onChange={(e) => {
                setPage(0);
                setStatusFilter(e.target.value);
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All</MenuItem>
              {statusOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Sort by"
              size="small"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="updatedAt">Last Updated</MenuItem>
              <MenuItem value="name">POD Name</MenuItem>
              <MenuItem value="status">Status</MenuItem>
              <MenuItem value="overallCompletion">Overall %</MenuItem>
              <MenuItem value="feCompletion">FE %</MenuItem>
              <MenuItem value="beCompletion">BE %</MenuItem>
              <MenuItem value="integrationCompletion">Integration %</MenuItem>
            </TextField>
            <TextField
              select
              label="Direction"
              size="small"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="desc">Desc</MenuItem>
              <MenuItem value="asc">Asc</MenuItem>
            </TextField>
          </Stack>

          <TableContainer sx={{ overflowX: 'auto', width: '100%' }}>
            <Table size="small" sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow>
                  <TableCell>POD Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>Developer</TableCell>
                  <TableCell>Machine Owner</TableCell>
                  <TableCell>Machine</TableCell>
                  <TableCell align="right">FE %</TableCell>
                  <TableCell align="right">BE %</TableCell>
                  <TableCell align="right">Integration %</TableCell>
                  <TableCell align="right">Overall %</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      position: 'sticky',
                      right: 0,
                      bgcolor: 'background.paper',
                      zIndex: 1,
                      minWidth: 160,
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row.id)} hover>
                    <TableCell>
                      <Link component={RouterLink} to={`/pods/${row.id}`}>
                        {String(row.name)}
                      </Link>
                    </TableCell>
                    <TableCell>{String(row.status ?? '—')}</TableCell>
                    <TableCell>
                      {row.startDate ? String(row.startDate).slice(0, 10) : '—'}
                    </TableCell>
                    <TableCell>{String(row.developers ?? '—')}</TableCell>
                    <TableCell>{String(row.machineOwner ?? '—')}</TableCell>
                    <TableCell>{String(row.machineAlignedToProject ?? '—')}</TableCell>
                    <TableCell align="right">{String(row.feCompletion ?? '—')}</TableCell>
                    <TableCell align="right">{String(row.beCompletion ?? '—')}</TableCell>
                    <TableCell align="right">
                      {String(row.integrationCompletion ?? '—')}
                    </TableCell>
                    <TableCell align="right">{String(row.overallCompletion ?? '—')}</TableCell>
                    <TableCell>
                      {row.updatedAt
                        ? new Date(String(row.updatedAt)).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        position: 'sticky',
                        right: 0,
                        bgcolor: 'background.paper',
                        zIndex: 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Button
                        size="small"
                        component={RouterLink}
                        to={`/pods/${row.id}`}
                        sx={{ mr: 0.5 }}
                      >
                        View
                      </Button>
                      <IconButton size="small" onClick={() => openEdit(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => deletePod(String(row.id), String(row.name))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12}>
                      <EmptyState title="No PODs match your filters" />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Update POD' : 'Add POD'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              size="small"
              fullWidth
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Description"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <TextField
              select
              label="Status"
              size="small"
              fullWidth
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {statusOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Start Date"
              type="date"
              size="small"
              fullWidth
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Developers"
              size="small"
              fullWidth
              value={form.developers}
              onChange={(e) => setForm((f) => ({ ...f, developers: e.target.value }))}
            />
            <TextField
              label="Machine Owner"
              size="small"
              fullWidth
              value={form.machineOwner}
              onChange={(e) => setForm((f) => ({ ...f, machineOwner: e.target.value }))}
            />
            <TextField
              label="Machine Aligned To Project"
              size="small"
              fullWidth
              value={form.machineAlignedToProject}
              onChange={(e) =>
                setForm((f) => ({ ...f, machineAlignedToProject: e.target.value }))
              }
            />
            <TextField
              label="FE Completion %"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 0, max: 100 }}
              value={form.feCompletion}
              onChange={(e) =>
                setForm((f) => ({ ...f, feCompletion: Number(e.target.value) }))
              }
            />
            <TextField
              label="BE Completion %"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 0, max: 100 }}
              value={form.beCompletion}
              onChange={(e) =>
                setForm((f) => ({ ...f, beCompletion: Number(e.target.value) }))
              }
            />
            <TextField
              label="Integration Completion %"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 0, max: 100 }}
              value={form.integrationCompletion}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  integrationCompletion: Number(e.target.value),
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !form.name.trim()} onClick={savePod}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
