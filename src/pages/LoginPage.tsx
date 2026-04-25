import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.tsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [school, setSchool] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(school.trim().toLowerCase(), username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Better SchoolSoft</h1>
        <p className="login-subtitle">Sign in with your SchoolSoft credentials</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="school">School</label>
          <input
            id="school"
            type="text"
            placeholder="e.g. nacka (from your school's URL)"
            value={school}
            onChange={(e) => { setSchool(e.target.value); }}
            required
            autoComplete="organization"
          />

          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); }}
            required
            autoComplete="username"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); }}
            required
            autoComplete="current-password"
          />

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-hint">
          The school name is the subdomain in your SchoolSoft URL, e.g.{' '}
          <code>https://sms.schoolsoft.se/nacka/…</code>
        </p>
      </div>
    </div>
  );
}
