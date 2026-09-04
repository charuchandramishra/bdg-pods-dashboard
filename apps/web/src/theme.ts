import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0B3D5C', light: '#1A5F86', dark: '#072A40' },
    secondary: { main: '#C45C26' },
    background: { default: '#F3F6F9', paper: '#FFFFFF' },
    success: { main: '#2E7D4F' },
    warning: { main: '#B86E00' },
    error: { main: '#B42318' },
    text: { primary: '#12202B', secondary: '#5B6B7A' },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 650 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px rgba(12, 34, 51, 0.06), 0 8px 24px rgba(12, 34, 51, 0.04)',
          border: '1px solid rgba(11, 61, 92, 0.06)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(90deg, #0B3D5C 0%, #134E6F 100%)',
        },
      },
    },
  },
});
