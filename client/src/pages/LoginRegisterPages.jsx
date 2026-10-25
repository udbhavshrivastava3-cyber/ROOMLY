import { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Paper, Typography, TextField, Button, Stack, Alert, Divider } from '@mui/material';
import { useAuth } from '../store/authStore';
import { apiError } from '../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login, homeFor } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sp] = useSearchParams();
  const next = sp.get('next');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(form.email)) return setError('Enter a valid email');
    if (!form.password) return setError('Enter your password');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      nav(next || homeFor(user.role));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 420, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Welcome back</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Sign in to manage your stays.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <form onSubmit={submit}>
        <Stack spacing={2}>
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Button type="submit" variant="contained" color="secondary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <Divider />
          <Typography variant="body2">New to Roomly? <RouterLink to="/register">Create an account</RouterLink></Typography>
        </Stack>
      </form>
    </Paper>
  );
}

export function RegisterPage() {
  const { register, homeFor } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2) return setError('Name must be at least 2 characters');
    if (!EMAIL_RE.test(form.email)) return setError('Enter a valid email');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,64}$/.test(form.password)) {
      return setError('Password needs 10+ characters with upper, lower and a digit');
    }
    // Optional Indian mobile number: accept "9876543210" or "+91 9876543210".
    const rawPhone = form.phone.replace(/[\s-]/g, '').replace(/^\+?91(?=\d{10}$)/, '');
    if (rawPhone && !/^[6-9]\d{9}$/.test(rawPhone)) {
      return setError('Phone (optional) should be a 10-digit Indian mobile, e.g. +91 9876543210');
    }
    setBusy(true);
    try {
      const user = await register(form.name.trim(), form.email, form.password, rawPhone ? `+91${rawPhone}` : '');
      nav(homeFor(user.role));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 420, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Create your account</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Guest accounts by default; staff roles are assigned by the hotel.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <form onSubmit={submit}>
        <Stack spacing={2}>
          <TextField label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
            helperText="At least 10 characters with upper, lower and a digit" />
          <TextField label="Phone (India, optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 98XXXXXX10" helperText="Optional — Indian mobile number" />
          <Button type="submit" variant="contained" color="secondary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
          <Divider />
          <Typography variant="body2">Already registered? <RouterLink to="/login">Sign in</RouterLink></Typography>
        </Stack>
      </form>
    </Paper>
  );
}
