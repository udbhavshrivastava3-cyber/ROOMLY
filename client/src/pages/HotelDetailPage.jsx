import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Grid, Card, CardMedia, CardContent, Chip, Typography, Stack, Alert, Skeleton, Button, Paper, Avatar, Rating, Divider, Box,
} from '@mui/material';
import api, { apiError } from '../services/api';
import { perNight } from '../utils/format';
const FALLBACK = 'https://placehold.co/900x500/E8E1D5/101820?text=Roomly';

export default function HotelDetailPage() {
  const { hotelId } = useParams();
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/hotels/${hotelId}`).then((r) => setData(r.data.data)).catch((e) => setError(apiError(e)));
    api.get(`/hotels/${hotelId}/reviews`).then((r) => setReviews(r.data.data)).catch(() => setReviews({ reviews: [], summary: { avgRating: null, count: 0 } }));
  }, [hotelId]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Skeleton variant="rounded" height={340} />;
  const { hotel, roomCategories } = data;

  return (
    <Stack spacing={4}>
      <Card sx={{ position: 'relative' }}>
        <CardMedia component="img" height="320" image={hotel.images?.[0] || FALLBACK} alt={hotel.name} />
        <CardContent>
          <Typography variant="h2" sx={{ color: '#101820' }}>{hotel.name}</Typography>
          <Typography color="text.secondary">
            {hotel.address?.city}, {hotel.address?.country} · {hotel.amenities?.join(' · ')}
          </Typography>
          <Typography sx={{ mt: 1.5 }}>{hotel.description}</Typography>
        </CardContent>
      </Card>

      <Typography variant="h4">Rooms & suites</Typography>
      {!roomCategories?.length && <Alert severity="info">This hotel's inventory is being curated — no rooms published yet.</Alert>}
      <Grid container spacing={3}>
        {(roomCategories || []).map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c._id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardMedia component="img" height="190" image={c.images?.[0] || FALLBACK} alt={c.name} />
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="h6">{c.name}</Typography>
                  <Chip variant="outlined" color="secondary" label={perNight(c.basePrice)} />
                </Stack>
                <Typography variant="body2" color="text.secondary">Sleeps {c.capacity} · {c.bedConfiguration}</Typography>
                <Box sx={{ mt: 'auto' }}>
                  <Button size="small" variant="outlined" component={RouterLink} to={`/rooms?category=${encodeURIComponent(c.name)}&hotel=${hotel._id}`}>
                    Browse {c.name}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h4">Guest reviews</Typography>
      <Paper sx={{ p: 2 }}>
        {reviews?.summary?.count > 0 ? (
          <Stack direction="row" spacing={2} alignItems="center" mb={1}>
            <Rating value={reviews.summary.avgRating} precision={0.5} readOnly />
            <Typography>{Number(reviews.summary.avgRating).toFixed(1)} · {reviews.summary.count} review(s)</Typography>
          </Stack>
        ) : (
          <Alert severity="info">No published reviews yet for this hotel.</Alert>
        )}
        {(reviews?.reviews || []).map((r) => (
          <Box key={r._id} sx={{ py: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar>{r.guest?.name?.[0] || '?'}</Avatar>
              <div>
                <Typography fontWeight={600}>{r.title || 'Review'}</Typography>
                <Rating value={r.rating} size="small" readOnly />
              </div>
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>{r.comment}</Typography>
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
      </Paper>
    </Stack>
  );
}
