import { createTheme, responsiveFontSizes } from '@mui/material/styles';

export const palette = {
  navy: '#101820',
  ivory: '#F7F4EE',
  gold: '#C6A66B',
  stone: '#E8E1D5',
  charcoal: '#343A40',
  success: '#2E7D32',
  warning: '#ED6C02',
  error: '#C62828',
};

const paletteTheme = responsiveFontSizes(
  createTheme({
    palette: {
      primary: { main: palette.navy, contrastText: '#fff' },
      secondary: { main: palette.gold },
      background: { default: palette.ivory, paper: '#FFFFFF' },
      success: { main: palette.success },
      error: { main: palette.error },
      warning: { main: palette.warning },
      text: { primary: palette.charcoal, secondary: '#6B7075' },
    },
    typography: {
      fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
      h1: { fontFamily: '"Playfair Display", Georgia, serif' },
      h2: { fontFamily: '"Playfair Display", Georgia, serif' },
      h3: { fontFamily: '"Playfair Display", Georgia, serif' },
      h4: { fontFamily: '"Playfair Display", Georgia, serif' },
      h5: { fontFamily: '"Playfair Display", Georgia, serif' },
      h6: { fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          containedPrimary: { '&:hover': { backgroundColor: '#1E2A36' } },
          containedSecondary: { color: palette.navy, fontWeight: 600 },
        },
      },
      MuiCard: { styleOverrides: { root: { border: `1px solid ${palette.stone}`, boxShadow: '0 6px 24px rgba(16,24,32,0.06)' } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiTableHead: { styleOverrides: { root: { backgroundColor: palette.navy } } },
      MuiTableCell: { styleOverrides: { root: { borderBottom: `1px solid ${palette.stone}` } } },
      MuiAppBar: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundColor: palette.navy } } },
    },
    prefersReducedMotion: true,
  })
);

export default paletteTheme;
export const luxury = {
  heroOverlay: 'linear-gradient(180deg, rgba(16,24,32,0.72) 0%, rgba(16,24,32,0.35) 55%, rgba(16,24,32,0.8) 100%)',
  goldBorder: `2px solid ${palette.gold}`,
  letterSpacing: '0.14em',
};
