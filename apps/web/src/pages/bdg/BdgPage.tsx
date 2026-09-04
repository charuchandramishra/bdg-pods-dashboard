import { useEffect, useMemo, useState } from 'react';
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
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bdgApi } from '../../services/endpoints';
import {
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingState,
  PageHeader,
} from '../../components/Common';

const PIE_COLORS = ['#0B3D5C', '#1A5F86', '#C45C26', '#2E7D4F', '#B86E00'];

const emptyForm = {
  memberName: '',
  totalInbound: 0,
  totalOutbound: 0,
  apacInbound: 0,
  apacOutbound: 0,
  menaInbound: 0,
  menaOutbound: 0,
  internationalInbound: 0,
  internationalOutbound: 0,
  ukeuInbound: 0,
  ukeuOutbound: 0,
  naInbound: 0,
  naOutbound: 0,
};

export default function BdgPage() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [regions, setRegions] = useState<
    Array<{ region: string; inbound: number; outbound: number; total: number }>
  >([]);
  const [top, setTop] = useState<
    Array<{
      memberName: string;
      totalLeads: number;
      totalInbound: number;
      totalOutbound: number;
    }>
  >([]);
  const [allMembers, setAllMembers] = useState<Array<{ id: string; memberName: string }>>([]);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [totals, setTotals] = useState<Record<string, unknown> | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [topN, setTopN] = useState(10);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const memberFilterParam = selectedMembers.length
    ? selectedMembers.join(',')
    : undefined;

  const query = useMemo(
    () => ({
      page: page + 1,
      pageSize,
      search: search || undefined,
      sortBy,
      sortDir,
      members: memberFilterParam,
    }),
    [page, pageSize, search, sortBy, sortDir, memberFilterParam],
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      bdgApi.summary(),
      bdgApi.byRegion({ members: memberFilterParam }),
      bdgApi.topMembers(topN, { members: memberFilterParam }),
      bdgApi.list(query),
      bdgApi.list({ page: 1, pageSize: 1000 }),
    ])
      .then(([s, r, t, list, all]) => {
        setSummary(s);
        setRegions(r);
        setTop(t);
        setRows(list.data);
        setTotals(list.totals ?? null);
        setTotal(list.total);
        setAllMembers(
          (all.data as Array<Record<string, unknown>>).map((m) => ({
            id: String(m.id),
            memberName: String(m.memberName),
          })),
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, topN, memberFilterParam, reloadKey]);

  // Prefer filtered list totals so Inbound vs Outbound tracks Compare members
  const inboundOutbound = useMemo(() => {
    const inbound = Number(
      totals?.totalInbound ?? summary?.inboundLeads ?? 0,
    );
    const outbound = Number(
      totals?.totalOutbound ?? summary?.outboundLeads ?? 0,
    );
    return [
      { type: 'Inbound', value: inbound },
      { type: 'Outbound', value: outbound },
    ];
  }, [totals, summary]);

  const displayKpis = useMemo(() => {
    if (selectedMembers.length && totals) {
      return {
        totalMembers: selectedMembers.length,
        totalLeads: Number(totals.totalLeads ?? 0),
        inboundLeads: Number(totals.totalInbound ?? 0),
        outboundLeads: Number(totals.totalOutbound ?? 0),
      };
    }
    return {
      totalMembers: summary?.totalMembers ?? 0,
      totalLeads: summary?.totalLeads ?? 0,
      inboundLeads: summary?.inboundLeads ?? 0,
      outboundLeads: summary?.outboundLeads ?? 0,
    };
  }, [selectedMembers.length, totals, summary]);

  const regionLabel = (region: string) =>
    region === 'INTERNATIONAL' ? 'INT' : region;

  const chartRegions = useMemo(
    () =>
      regions.map((r) => ({
        ...r,
        region: regionLabel(r.region),
      })),
    [regions],
  );

  const regionPie = useMemo(
    () => chartRegions.map((r) => ({ name: r.region, value: r.total })),
    [chartRegions],
  );

  const topChartData = useMemo(
    () =>
      top.map((m) => ({
        memberName: m.memberName,
        Inbound: m.totalInbound ?? 0,
        Outbound: m.totalOutbound ?? 0,
      })),
    [top],
  );

  const download = async (format: 'csv' | 'xlsx') => {
    const url = bdgApi.exportUrl(format, {
      search: search || '',
      members: memberFilterParam || '',
    });
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bdg-export.${format === 'csv' ? 'csv' : 'xlsx'}`;
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
      memberName: String(row.memberName ?? ''),
      totalInbound: Number(row.totalInbound ?? 0),
      totalOutbound: Number(row.totalOutbound ?? 0),
      apacInbound: Number(row.apacInbound ?? 0),
      apacOutbound: Number(row.apacOutbound ?? 0),
      menaInbound: Number(row.menaInbound ?? 0),
      menaOutbound: Number(row.menaOutbound ?? 0),
      internationalInbound: Number(row.internationalInbound ?? 0),
      internationalOutbound: Number(row.internationalOutbound ?? 0),
      ukeuInbound: Number(row.ukeuInbound ?? 0),
      ukeuOutbound: Number(row.ukeuOutbound ?? 0),
      naInbound: Number(row.naInbound ?? 0),
      naOutbound: Number(row.naOutbound ?? 0),
    });
    setEditOpen(true);
  };

  const saveMember = async () => {
    setBusy(true);
    setError('');
    try {
      if (editId) await bdgApi.update(editId, form);
      else await bdgApi.create(form);
      setEditOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteMember = async (id: string, name: string) => {
    if (!window.confirm(`Delete BDG member "${name}"?`)) return;
    try {
      await bdgApi.remove(id);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading && !summary) return <LoadingState />;
  if (error && !summary) return <ErrorState message={error} />;
  if (!summary) {
    return <EmptyState title="No BDG data" description="Upload a BDG report to begin." />;
  }

  return (
    <Box>
      <PageHeader
        title="BDG Dashboard"
        subtitle="Lead performance by member and region"
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => download('csv')}>
              Export CSV
            </Button>
            <Button variant="outlined" onClick={() => download('xlsx')}>
              Export Excel
            </Button>
            <Button variant="contained" onClick={openCreate}>
              Add Member
            </Button>
          </Stack>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Total Members" value={displayKpis.totalMembers} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Total Leads" value={displayKpis.totalLeads} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Inbound Leads" value={displayKpis.inboundLeads} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Outbound Leads" value={displayKpis.outboundLeads} />
        </Grid>
      </Grid>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Compare members</InputLabel>
          <Select
            multiple
            value={selectedMembers}
            onChange={(e) =>
              setSelectedMembers(
                typeof e.target.value === 'string'
                  ? e.target.value.split(',')
                  : e.target.value,
              )
            }
            input={<OutlinedInput label="Compare members" />}
            renderValue={(selected) =>
              selected.length ? `${selected.length} selected` : 'All members'
            }
          >
            {allMembers.map((m) => (
              <MenuItem key={m.id} value={m.memberName}>
                <Checkbox checked={selectedMembers.includes(m.memberName)} />
                <ListItemText primary={m.memberName} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button size="small" onClick={() => setSelectedMembers([])}>
          Clear selection (All)
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Leads by Region
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartRegions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="region" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="inbound" fill="#0B3D5C" name="Inbound" />
                  <Bar dataKey="outbound" fill="#C45C26" name="Outbound" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Top Members by Total Leads</Typography>
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
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topChartData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="memberName" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Inbound" fill="#0B3D5C" name="Inbound" />
                  <Bar dataKey="Outbound" fill="#C45C26" name="Outbound" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Inbound vs Outbound
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={inboundOutbound}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Leads">
                    {inboundOutbound.map((entry) => (
                      <Cell
                        key={entry.type}
                        fill={entry.type === 'Inbound' ? '#0B3D5C' : '#C45C26'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Regional Lead Share
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={regionPie}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={85}
                    label
                  >
                    {regionPie.map((_, i) => (
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
              label="Search member"
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
              label="Sort by"
              size="small"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="updatedAt">Last Updated</MenuItem>
              <MenuItem value="memberName">Member</MenuItem>
              <MenuItem value="totalInbound">Inbound</MenuItem>
              <MenuItem value="totalOutbound">Outbound</MenuItem>
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

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>BDG Member</TableCell>
                <TableCell align="right">Inbound</TableCell>
                <TableCell align="right">Outbound</TableCell>
                <TableCell align="right">APAC</TableCell>
                <TableCell align="right">MENA</TableCell>
                <TableCell align="right">International</TableCell>
                <TableCell align="right">UK/EU</TableCell>
                <TableCell align="right">NA</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={String(row.id)} hover>
                  <TableCell>{String(row.memberName)}</TableCell>
                  <TableCell align="right">{String(row.totalInbound ?? 0)}</TableCell>
                  <TableCell align="right">{String(row.totalOutbound ?? 0)}</TableCell>
                  <TableCell align="right">{String(row.apacTotal ?? 0)}</TableCell>
                  <TableCell align="right">{String(row.menaTotal ?? 0)}</TableCell>
                  <TableCell align="right">{String(row.internationalTotal ?? 0)}</TableCell>
                  <TableCell align="right">{String(row.ukeuTotal ?? 0)}</TableCell>
                  <TableCell align="right">{String(row.naTotal ?? 0)}</TableCell>
                  <TableCell>
                    {row.updatedAt
                      ? new Date(String(row.updatedAt)).toLocaleString()
                      : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(row)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() =>
                        deleteMember(String(row.id), String(row.memberName))
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {totals ? (
                <TableRow sx={{ bgcolor: 'rgba(11,61,92,0.06)' }}>
                  <TableCell>
                    <strong>Total</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{String(totals.totalInbound ?? 0)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{String(totals.totalOutbound ?? 0)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{String(totals.apacTotal ?? 0)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{String(totals.menaTotal ?? 0)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{String(totals.internationalTotal ?? 0)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{String(totals.ukeuTotal ?? 0)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{String(totals.naTotal ?? 0)}</strong>
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              ) : null}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <EmptyState title="No members match your filters" />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
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
        <DialogTitle>{editId ? 'Update BDG Member' : 'Add BDG Member'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {(
              [
                ['memberName', 'BDG Member'],
                ['totalInbound', 'Inbound'],
                ['totalOutbound', 'Outbound'],
                ['apacInbound', 'APAC Inbound'],
                ['apacOutbound', 'APAC Outbound'],
                ['menaInbound', 'MENA Inbound'],
                ['menaOutbound', 'MENA Outbound'],
                ['internationalInbound', 'International Inbound'],
                ['internationalOutbound', 'International Outbound'],
                ['ukeuInbound', 'UK/EU Inbound'],
                ['ukeuOutbound', 'UK/EU Outbound'],
                ['naInbound', 'NA Inbound'],
                ['naOutbound', 'NA Outbound'],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                type={key === 'memberName' ? 'text' : 'number'}
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    [key]:
                      key === 'memberName'
                        ? e.target.value
                        : Number(e.target.value),
                  }))
                }
                fullWidth
                size="small"
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={saveMember}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
