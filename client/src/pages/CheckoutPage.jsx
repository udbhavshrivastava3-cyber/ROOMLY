import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Paper, Typography, Stack, Button, Alert, Divider, Skeleton, List, ListItem, ListItemText } from '@mui/material';
import api, { apiError } from '../services/api';
import { dateIN, inrPrecise } from '../utils/format';

export default function CheckoutPage() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/bookings/${bookingId}`).then((r) => setBooking(r.data.data.booking)).catch((e) => setError(apiError(e)));
  }, [bookingId]);

  const startDemo = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/bookings/${bookingId}/payments/demo`);
      setSheet(r.data.data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (result) => {
    setBusy(true);
    try {
      const r = await api.post(`/bookings/${bookingId}/payments/demo/confirm`, { result });
      if (r.data.data.paymentStatus === 'succeeded') {
        nav(`/confirmation/${bookingId}`);
      } else {
        setError('Payment was declined (simulated). You can try again — the booking remains unpaid.');
        setSheet(null); // allow retry
      }
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !booking) return <Alert severity="error">{error}</Alert>;
  if (!booking) return <Skeleton variant="rounded" height={300} />;

  if (booking.status === 'confirmed') nav(`/confirmation/${bookingId}`);

  return (
    <Paper sx={{ p: 4, maxWidth: 640, mx: 'auto' }}>
      <Alert severity="warning" sx={{ mb: 3 }} icon={<span>🧪</span>}>
        <strong>Roomly Demo Pay — simulation only</strong>. No real payment is processed and no real transaction exists. For college demonstration.
      </Alert>
      <Typography variant="h4">Checkout</Typography>
      <List>
        <ListItem><ListItemText primary={`Booking ${booking.reference}`} secondary={`${booking.roomCategory?.name} · ${dateIN(booking.checkIn)} → ${dateIN(booking.checkOut)}`} /></ListItem>
        <Divider />
        <ListItem><ListItemText primary="Subtotal" secondary={`${inrPrecise(booking.price.baseSubtotal)}`} /></ListItem>
        <ListItem><ListItemText primary={`Service charge (${((booking.price.serviceCharge / booking.price.baseSubtotal) * 100).toFixed(0)}%)`} secondary={`${inrPrecise(booking.price.serviceCharge)}`} /></ListItem>
        <ListItem><ListItemText primary={`GST/room tax (${((booking.price.tax / booking.price.baseSubtotal) * 100).toFixed(0)}%)`} secondary={`${inrPrecise(booking.price.tax)}`} /></ListItem>
        <ListItem><ListItemText primaryTypographyProps={{ fontWeight: 700 }} primary="Total due (INR)" secondaryTypographyProps={{ fontWeight: 700 }} secondary={`${inrPrecise(booking.price.total)}`} /></ListItem>
      </List>
      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
      {!sheet ? (
        <Button variant="contained" color="secondary" size="large" onClick={startDemo} disabled={busy}>
          {busy ? 'Preparing…' : 'Pay with Roomly Demo Pay'}
        </Button>
      ) : (
        <Stack spacing={2}>
          <Divider />
          <Typography gutterBottom>Simulated gateway result — choose an outcome to verify server-side status handling:</Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" color="primary" onClick={() => confirm('succeed')} disabled={busy}>Approve payment (demo)</Button>
            <Button variant="outlined" color="error" onClick={() => confirm('fail')} disabled={busy}>Decline (demo)</Button>
          </Stack>
        </Stack>
      )}
      <Button onClick={() => nav('/my-bookings')} sx={{ mt: 3 }}>Back to my bookings</Button>
    </Paper>
  );
}
