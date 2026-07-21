'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '', organization: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Registration failed');
      localStorage.setItem('token', body.token); localStorage.setItem('user', JSON.stringify(body.user)); router.push('/vendors');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Registration failed'); }
    finally { setLoading(false); }
  }
  return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><form onSubmit={submit} className="bg-white shadow rounded-lg p-8 w-full max-w-md space-y-4">
    <h1 className="text-2xl font-bold">Create an organization</h1>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {(['firstName','lastName','organization','email','password','confirmPassword'] as const).map(key => <label key={key} className="block text-sm font-medium">{key.replace(/([A-Z])/g, ' $1')}<input name={key} type={key.toLowerCase().includes('password') ? 'password' : key === 'email' ? 'email' : 'text'} required minLength={key === 'password' ? 12 : undefined} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>)}
    <button disabled={loading} className="w-full bg-indigo-600 text-white rounded py-2 disabled:opacity-50">{loading ? 'Creating…' : 'Create tenant owner'}</button>
    <p className="text-sm"><Link className="text-indigo-700" href="/login">Already registered? Sign in</Link></p>
  </form></main>;
}
