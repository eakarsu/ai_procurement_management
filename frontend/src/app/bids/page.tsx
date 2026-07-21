'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

type Vendor = { id: string; name: string };
type Bid = { id: string; title: string; description?: string; proposedAmount?: number; status: string; vendor: Vendor };
const nextStatus: Record<string,string> = { SUBMITTED: 'UNDER_EVALUATION', UNDER_EVALUATION: 'EVALUATED', EVALUATED: 'AWARDED' };
export default function BidsPage() {
  const [bids,setBids]=useState<Bid[]>([]); const [vendors,setVendors]=useState<Vendor[]>([]); const [form,setForm]=useState({title:'',description:'',vendorId:'',proposedAmount:''}); const [error,setError]=useState(''); const router=useRouter();
  const headers=()=>({ Authorization:`Bearer ${localStorage.getItem('token')}` });
  const load=useCallback(async()=>{ if(!localStorage.getItem('token')) return router.push('/login'); const [bidRes,vendorRes]=await Promise.all([fetch(`${API_URL}/api/bids`,{headers:headers()}),fetch(`${API_URL}/api/vendors`,{headers:headers()})]); if(bidRes.status===401||bidRes.status===403)return router.push('/login'); setBids((await bidRes.json()).data||[]); setVendors((await vendorRes.json()).data||[]);},[router]);
  useEffect(()=>{void load();},[load]);
  async function create(event:FormEvent){event.preventDefault();setError('');const response=await fetch(`${API_URL}/api/bids`,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({...form,proposedAmount:Number(form.proposedAmount)})});const body=await response.json();if(!response.ok)return setError(body.message||'Unable to create bid');setForm({title:'',description:'',vendorId:'',proposedAmount:''});await load();}
  async function transition(bid:Bid,status:string){const response=await fetch(`${API_URL}/api/bids/${bid.id}/status`,{method:'PATCH',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({status})});if(!response.ok){const body=await response.json();return setError(body.message||'Transition failed');}await load();}
  return <main className="max-w-5xl mx-auto p-8 space-y-8"><header className="flex justify-between"><div><h1 className="text-3xl font-bold">Procurement bids</h1><p className="text-gray-600">Persisted lifecycle with audited, role-gated transitions.</p></div><Link href="/vendors" className="text-indigo-700">Manage vendors</Link></header>
    <form onSubmit={create} className="grid md:grid-cols-2 gap-3 bg-white shadow rounded p-4"><input required placeholder="Bid title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="border rounded px-3 py-2"/><select required value={form.vendorId} onChange={e=>setForm({...form,vendorId:e.target.value})} className="border rounded px-3 py-2"><option value="">Choose vendor</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><input required type="number" min="0.01" step="0.01" placeholder="Proposed amount" value={form.proposedAmount} onChange={e=>setForm({...form,proposedAmount:e.target.value})} className="border rounded px-3 py-2"/><input required placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="border rounded px-3 py-2"/><button className="md:col-span-2 bg-indigo-600 text-white rounded py-2">Submit bid</button>{error&&<p role="alert" className="md:col-span-2 text-red-700">{error}</p>}</form>
    <div className="bg-white shadow rounded divide-y">{bids.map(b=><article key={b.id} className="p-4 flex items-center justify-between"><div><h2 className="font-semibold">{b.title}</h2><p className="text-sm text-gray-600">{b.vendor.name} · ${b.proposedAmount?.toLocaleString()} · {b.status}</p></div><div className="space-x-2">{nextStatus[b.status]&&<button onClick={()=>transition(b,nextStatus[b.status])} className="border rounded px-3 py-1">Move to {nextStatus[b.status]}</button>}{['SUBMITTED','UNDER_EVALUATION','EVALUATED'].includes(b.status)&&<button onClick={()=>transition(b,'REJECTED')} className="border border-red-300 text-red-700 rounded px-3 py-1">Reject</button>}</div></article>)}{!bids.length&&<p className="p-6 text-gray-600">No bids yet.</p>}</div>
  </main>;
}
