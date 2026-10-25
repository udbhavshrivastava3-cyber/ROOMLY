import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardMedia, CardContent, Chip, Button, Stack, MenuItem, Select, TextField, Pagination, Alert, Skeleton, FormControl, FormLabel,
} from '@mui/material';
import api, { apiError } from '../services/api';
import { perNight } from '../utils/format';

export default function RoomsSearchPage() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [city, setCity] = useState(sp.get('q') || '');
  const [guests, setGuests] = useState(sp.get('guests') || '2');
  const [maxPrice, setMaxPrice] = useState(sp.get('maxPrice') || '');

  const query = sp.toString();

  useEffect(() => {
    setLoading(true);
    api.get(`/rooms?${query}`)
      .then((r) => setData(r.data.data))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [query]);

  const update = (obj) => {
    const next = new URLSearchParams(sp);
    Object.entries(obj).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
    setSp(next);
  };

  const checkIn = sp.get('checkIn');
  const checkOut = sp.get('checkOut');
  const canCheckAvailability = checkIn && checkOut && checkOut > checkIn;

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Find your stay</Typography>
      <Card sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm><TextField label="City" fullWidth value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lisbon" /></Grid>
          <Grid item xs={6} sm><TextField label="Check-in" type="date" fullWidth InputLabelProps={{ shrink: true }} value={checkIn || ''} onChange={(e) => update({ checkIn: e.target.value })} /></Grid>
          <Grid item xs={6} sm><TextField label="Check-out" type="date" fullWidth InputLabelProps={{ shrink: true }} value={checkOut || ''} error={!!(checkIn && checkOut && checkOut <= checkIn)} helperText={checkIn && checkOut && checkOut <= checkIn ? 'Check-out must be after check-in' : ''} onChange={(e) => update({ checkOut: e.target.value })} /></Grid>
          <Grid item xs={6} sm={3}>
            <Select fullWidth value={guests} displayEmpty onChange={(e) => setGuests(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</MenuItem>)}
            </Select>
          </Grid>
          <Grid item xs={6} sm={3}><TextField label="Max price" type="number" fullWidth value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} InputProps={{ inputProps: { min: 0 } }} /></Grid>
          <Grid item xs={12}>
            <Button variant="contained" onClick={() => update({ q: city, guests, maxPrice })}>Apply filters</Button>
          </Grid>
        </Grid>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}
      {loading && (
        <Grid container spacing={3}>{[1, 2, 3].map((i) => <Grid item xs={12} md={4} key={i}><Skeleton variant="rounded" height={320} /></Grid>)}</Grid>
      )}
      {data && data.rooms.length === 0 && <Alert severity="info">No rooms matched these filters. Try widening dates or clearing filters.</Alert>}
      {data && data.rooms.length > 0 && (
        <>
          <Grid container spacing={3}>
            {data.rooms.map((r) => (
              <Grid item xs={12} sm={6} md={4} key={r._id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia component="img" height="190"
                    image={r.images?.[0] || 'https://placehold.co/600x400/E8E1D5/101820?text=Roomly'}
                    alt={r.name} />
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="h6">{r.name}</Typography>
                      <Chip color="secondary" label={perNight(r.basePrice)} variant="outlined" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {(r.hotel && r.hotel.name) || 'Hotel'} — {r.hotel?.address?.city}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" label={`${r.capacity} guests`} />
                      {(r.amenities || []).slice(0, 2).map((a) => <Chip key={a} size="small" label={a} />)}
                    </Stack>
                    <Box sx={{ mt: 'auto', pt: 1 }}>
                      {canCheckAvailability ? (
                        <Button fullWidth variant="contained" onClick={() => nav(`/rooms/${r.bookableRoomIds[0]}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`)}>
                          Check availability
                        </Button>
                      ) : (
                        <Button fullWidth variant="outlined" component={RouterLink} to={`/rooms/${r.bookableRoomIds[0]}`}>View room</Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          {data.pagination.pages > 1 && (
            <Pagination
              count={data.pagination.pages} page={data.pagination.page}
              onChange={(_, p) => update({ page: p })} sx={{ alignSelf: 'center' }}
            />
          )}
        </>
      )}
    </Stack>
  );
}
