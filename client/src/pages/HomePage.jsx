import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Typography, TextField, MenuItem, Button, Grid, Card, CardMedia, CardContent, Chip, Stack, InputAdornment, Skeleton, Alert, Paper,
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import { luxury } from '../theme';
import api, { apiError } from '../services/api';
import { perNight } from '../utils/format';

const HERO = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=70';

export default function HomePage() {
  const nav = useNavigate();
  const [hotels, setHotels] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState({ hotelName: '', checkIn: '', checkOut: '', guests: 2 });

  useEffect(() => {
    api.get('/hotels').then((r) => setHotels(r.data.data.hotels)).catch((e) => setError(apiError(e)));
    api.get('/rooms?limit=3&sort=price_desc').then((r) => setFeatured(r.data.data.rooms)).catch((e) => setError(apiError(e)));
  }, []);

  const minCI = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);
  const submitSearch = () => {
    const params = new URLSearchParams();
    if (q.hotelName) params.set('q', q.hotelName);
    if (q.checkIn) params.set('checkIn', q.checkIn);
    if (q.checkOut) params.set('checkOut', q.checkOut);
    if (q.guests) params.set('guests', String(q.guests));
    nav(`/rooms?${params.toString()}`);
  };

  return (
    <Stack spacing={6}>
      <Paper
        sx={{
          position: 'relative', minHeight: 420, display: 'flex', alignItems: 'center',
          backgroundImage: `url(${HERO})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 3, overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, background: luxury.heroOverlay }} />
        <Container sx={{ position: 'relative', color: '#fff', py: 8 }}>
          <Typography sx={{ color: 'secondary.main', letterSpacing: luxury.letterSpacing, textTransform: 'uppercase', fontSize: 12 }}>
            Roomly · boutique stays & grand hotels
          </Typography>
          <Typography variant="h2" sx={{ color: '#fff', mb: 2, maxWidth: 640 }}>
            A refined way to run and reserve exceptional stays.
          </Typography>
          <Typography sx={{ opacity: 0.85, maxWidth: 560 }}>
            Guest booking, staff operations, housekeeping and management analytics for hospitality teams — with a demo payment mode for coursework.
          </Typography>
          <Paper sx={{ mt: 4, p: 2, bgcolor: 'rgba(255,255,255,0.96)' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md>
                <TextField
                  label="Hotel" fullWidth select value={hotels && q.hotelName === '' ? '' : q.hotelName}
                  onChange={(e) => setQ({ ...q, hotelName: e.target.value })}
                  error={!!error}
                  helperText={error}
                >
                  <MenuItem value="">All hotels</MenuItem>
                  {(hotels || []).map((h) => (
                    <MenuItem key={h._id} value={h.name}>{h.name} — {h.address?.city}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={4} md>
                <TextField label="Check-in" type="date" fullWidth value={q.checkIn} inputProps={{ min: minCI }}
                  onChange={(e) => setQ({ ...q, checkIn: e.target.value })} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={4} md>
                <TextField label="Check-out" type="date" fullWidth value={q.checkOut} inputProps={{ min: q.checkIn || minCI }}
                  onChange={(e) => setQ({ ...q, checkOut: e.target.value })} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={4} md="auto">
                <TextField select label="Guests" value={q.guests} onChange={(e) => setQ({ ...q, guests: e.target.value })} sx={{ minWidth: 110 }}
                  InputProps={{ endAdornment: <InputAdornment position="end"><PersonIcon /></InputAdornment> }}>
                  {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md="auto">
                <Button variant="contained" size="large" color="secondary" onClick={submitSearch} startIcon={<SearchIcon />} sx={{ px: 3 }}>
                  Search rooms
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Container>
      </Paper>

      <Container>
        <Typography variant="h4" sx={{ mb: 3 }}>Featured suites</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Grid container spacing={3}>
          {(featured || []).map((r) => (
            <Grid item xs={12} sm={6} md={4} key={r._id}>
              <Card sx={{ height: '100%' }}>
                <CardMedia component="img" height="180" image={r.images?.[0] || 'https://placehold.co/600x400/E8E1D5/101820?text=Roomly'} alt={r.name} />
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{r.name}</Typography>
                    <Chip label={perNight(r.basePrice)} variant="outlined" color="secondary" />
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    {r.hotel?.name} · {r.hotel?.address?.city}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {!featured && [1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={280} /></Grid>
          ))}
          {featured && featured.length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">No rooms in the catalogue yet. An administrator can seed demo inventory.</Alert>
            </Grid>
          )}
        </Grid>
      </Container>
    </Stack>
  );
}
