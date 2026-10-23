'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';

type Account = {
  id: string;
  email: string;
  display_name: string;
  created_at?: string;
};

export function ProfileView() {
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/auth/status');
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to read auth status.');
      setAuthenticated(Boolean(data.authenticated));
      setAccount(data.account ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read auth status.');
      setAuthenticated(false);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password,
            displayName: displayName.trim() || undefined,
          }),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || 'Registration failed.');
        // Auto-login after register
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const loginData = await parseJson(loginRes);
        if (!loginRes.ok) throw new Error(loginData?.error || 'Registered — please log in.');
        setPassword('');
        await refresh();
        return;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Login failed.');
      setPassword('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Profile</h1>
        <p>Operator account for this HarvYX Bot deployment.</p>
      </div>

      {loading ? <p className="shell-muted">Checking session…</p> : null}
      {error ? <p className="shell-error" role="alert">{error}</p> : null}

      {!loading && authenticated && account ? (
        <section className="shell-form-card">
          <div className="settings-row">
            <span>Status</span>
            <span className="badge badge-active">Signed in</span>
          </div>
          <div className="settings-row">
            <span>Display name</span>
            <span className="settings-value">{account.display_name || '—'}</span>
          </div>
          <div className="settings-row">
            <span>Email</span>
            <span className="settings-value">{account.email}</span>
          </div>
          <div className="shell-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" disabled={busy} onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </section>
      ) : null}

      {!loading && !authenticated ? (
        <section className="shell-form-card">
          <div className="shell-meta" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`btn-secondary${mode === 'login' ? ' is-selected' : ''}`}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className={`btn-secondary${mode === 'register' ? ' is-selected' : ''}`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>
          <form onSubmit={handleSubmit} className="shell-auth-form">
            {mode === 'register' ? (
              <input
                className="shell-input"
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            ) : null}
            <input
              className="shell-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              className="shell-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
