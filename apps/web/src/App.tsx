import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import BdgPage from './pages/bdg/BdgPage';
import PodsPage from './pages/pods/PodsPage';
import PodDetailPage from './pages/pods/PodDetailPage';
import UploadsPage from './pages/uploads/UploadsPage';
import ImportsPage, { ImportDetailPage } from './pages/imports/ImportsPage';
import { theme } from './theme';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/bdg" element={<BdgPage />} />
            <Route path="/pods" element={<PodsPage />} />
            <Route path="/pods/:id" element={<PodDetailPage />} />
            <Route path="/uploads" element={<UploadsPage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/imports/:id" element={<ImportDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
