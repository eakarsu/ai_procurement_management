'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

type Vendor = { id: string; name: string; email?: string; industryType?: string; qualificationStatus: string; isActive: boolean };
export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]); const [form, setForm] = useState({ name: '', email: '', industryType: '' }); const [error, setError] = useState('');
  const router = useRouter();
  const load = useCallback(async () => { const token = localStorage.getItem('token'); if (!token) return router.push('/login'); const response = await fetch(`${API_URL}/api/vendors`, { headers: { Authorization: `Bearer ${token}` } }); if (response.status === 401 || response.status === 403) return router.push('/login'); const body = await response.json(); setVendors(body.data || []); }, [router]);
  useEffect(() => { void load(); }, [load]);
  async function create(event: FormEvent) { event.preventDefault(); setError(''); const response = await fetch(`${API_URL}/api/vendors`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const body = await response.json(); if (!response.ok) return setError(body.message || 'Unable to create vendor'); setForm({ name: '', email: '', industryType: '' }); await load(); }
  return <main className="max-w-5xl mx-auto p-8 space-y-8"><header className="flex justify-between"><div><h1 className="text-3xl font-bold">Tenant vendors</h1><p className="text-gray-600">Only vendors owned by your organization are visible.</p></div><Link href="/bids" className="text-indigo-700">Manage bids</Link></header>
    <form onSubmit={create} className="grid md:grid-cols-4 gap-3 bg-white shadow rounded p-4"><input required placeholder="Vendor name" value={form.name} onChange={e => setForm({...form,name:e.target.value})} className="border rounded px-3 py-2"/><input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} className="border rounded px-3 py-2"/><input placeholder="Industry" value={form.industryType} onChange={e => setForm({...form,industryType:e.target.value})} className="border rounded px-3 py-2"/><button className="bg-indigo-600 text-white rounded">Add vendor</button>{error && <p role="alert" className="md:col-span-4 text-red-700">{error}</p>}</form>
    <div className="bg-white shadow rounded divide-y">{vendors.map(v => <article key={v.id} className="p-4 flex justify-between"><div><h2 className="font-semibold">{v.name}</h2><p className="text-sm text-gray-600">{v.email || 'No email'} · {v.industryType || 'Uncategorized'}</p></div><span>{v.qualificationStatus}</span></article>)}{!vendors.length && <p className="p-6 text-gray-600">No vendors yet.</p>}</div>
  </main>;
}
