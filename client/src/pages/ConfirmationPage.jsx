import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Paper, Typography, Stack, Button, Alert, Skeleton, Divider, Chip } from '@mui/material';
import api, { apiError } from '../services/api';
import { dateIN, inrPrecise } from '../utils/format';

export default function ConfirmationPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/bookings/${bookingId}`).then((r) => setBooking(r.data.data.booking)).catch((e) => setError(apiError(e)));
    api.get(`/bookings/${bookingId}/invoice`).then((r) => setInvoice(r.data.data.invoice)).catch(() => setInvoice(null));
  }, [bookingId]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!booking) return <Skeleton variant="rounded" height={300} />;

  return (
    <Paper sx={{ p: 4, maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h3" color="primary" fontFamily='"Playfair Display", serif'>Your stay is confirmed</Typography>
      <Chip color="success" label={booking.status} sx={{ my: 2 }} />
      <Typography>Booking reference: <strong>{booking.reference}</strong></Typography>
      <Divider sx={{ my: 3 }} />
      <Stack spacing={1} alignItems="center">
        <Typography>{booking.roomCategory?.name} · Room {booking.room?.roomNumber}</Typography>
        <Typography color="text.secondary">
          {dateIN(booking.checkIn)} → {dateIN(booking.checkOut)} · {booking.guestCount} guests
        </Typography>
        <Typography variant="h6">Total paid: {inrPrecise(booking.price.total)} {booking.price.currency}</Typography>
        {invoice && (
          <Typography variant="body2" color="text.secondary">
            Invoice {invoice.invoiceNumber} ({invoice.paymentOutcome})
          </Typography>
        )}
      </Stack>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
        <Button component={RouterLink} to="/my-bookings" variant="contained">My bookings</Button>
        <Button component={RouterLink} to="/" variant="text">Back to home</Button>
      </Stack>
    </Paper>
  );
}
