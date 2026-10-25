import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Typography, Stack, Card, CardContent, Chip, Button, Alert, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Pagination } from '@mui/material';
import api, { apiError } from '../services/api';
import { dateIN, inrPrecise } from '../utils/format';

const STATUS_COLOR = {
  pending_payment: 'warning', confirmed: 'success', checked_in: 'info', checked_out: 'default',
  cancellation_requested: 'warning', cancelled: 'error', expired: 'default',
};

export default function MyBookingsPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get(`/bookings/my?page=${page}`)
      .then((r) => setData(r.data.data))
      .catch((e) => setError(apiError(e)));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const submitCancel = async () => {
    setBusy(true);
    try {
      await api.post(`/bookings/${cancelTarget._id}/cancel`, { reason });
      setCancelTarget(null);
      load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : <Skeleton height={260} />;

  return (
    <Stack spacing={3}>
      <Typography variant="h3">My bookings</Typography>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {data.bookings.length === 0 && <Alert severity="info">No bookings yet — <RouterLink to="/rooms">explore rooms</RouterLink>.</Alert>}
      {data.bookings.map((b) => (
        <Card key={b._id}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
              <div>
                <Chip size="small" color={STATUS_COLOR[b.status]} label={b.status.replace(/_/g, ' ')} sx={{ mb: 1 }} />
                <Typography variant="h6" fontFamily='"Playfair Display", serif'>{b.roomCategory?.name} · Room {b.room?.roomNumber}</Typography>
                <Typography color="text.secondary">{b.hotel?.name}</Typography>
                <Typography variant="body2">
                  {dateIN(b.checkIn)} → {dateIN(b.checkOut)} · {b.guestCount} guests · {inrPrecise(b.price.total)}
                </Typography>
              </div>
              <Stack spacing={1} alignItems="flex-end">
                <Button size="small" component={RouterLink} to={`/checkout/${b._id}`} disabled={b.status !== 'pending_payment'}>Complete payment</Button>
                <Button size="small" component={RouterLink} to={`/confirmation/${b._id}`}>Details / Invoice</Button>
                <Button size="small" color="error"
                  onClick={() => setCancelTarget(b)}
                  disabled={!['pending_payment', 'confirmed'].includes(b.status)}>
                  {b.status === 'cancellation_requested' ? 'Cancellation pending review' : 'Cancel / refund'}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
      {data.pagination.pages > 1 && <Pagination count={data.pagination.pages} page={page} onChange={(_, p) => setPage(p)} sx={{ alignSelf: 'center' }} />}

      <Dialog open={!!cancelTarget} onClose={() => setCancelTarget(null)}>
        <DialogTitle>Request cancellation</DialogTitle>
        <DialogContent>
          {cancelTarget?.paymentStatus === 'paid' && (
            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
              This booking was paid — the hotel will review the cancellation and, if approved, a refund is recorded (demo mode updates the refund status only; no real funds move).
            </Alert>
          )}
          <TextField label="Reason (optional)" multiline minRows={2} fullWidth value={reason} onChange={(e) => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelTarget(null)}>Keep booking</Button>
          <Button color="error" onClick={submitCancel} disabled={busy}>{busy ? 'Submitting…' : 'Request cancellation'}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
