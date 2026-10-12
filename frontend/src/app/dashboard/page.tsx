'use client';

import AIResponseReport from "../../components/AIResponseReport";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: number;
  email: string;
  role: string;
}

interface DashboardStats {
  totalVendors: number;
  activeBids: number;
  pendingApprovals: number;
  completedProcurements: number;
  monthlySpending: number;
  complianceScore: number;
}

const analysisPresets = [
  { label: 'Vendor performance', analysisType: 'vendor-optimization', focus: 'Compare supplier delivery reliability and contract performance.', context: 'Prioritize measurable service levels and repeat purchasing patterns.', constraints: 'Flag missing supplier evidence for human review.' },
  { label: 'Cost reduction', analysisType: 'cost-reduction', focus: 'Identify practical savings in recurring procurement spend.', context: 'Consider volume consolidation, renewal timing, and total cost.', constraints: 'Preserve quality and existing contract obligations.' },
  { label: 'Risk review', analysisType: 'risk-assessment', focus: 'Assess supplier and purchasing continuity risks.', context: 'Highlight concentration, delivery delays, and financial exposure.', constraints: 'Distinguish observed facts from assumptions.' },
  { label: 'Compliance review', analysisType: 'compliance-review', focus: 'Review procurement controls and approval gaps.', context: 'Consider purchasing approvals, documentation, and audit readiness.', constraints: 'Identify evidence needed before making a compliance conclusion.' },
];

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);
  const [analysisForm, setAnalysisForm] = useState({ analysisType: '', focus: '', context: '', constraints: '' });
  const [analysisError, setAnalysisError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchDashboardStats(token);
  }, [router]);

  const fetchDashboardStats = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleAIAnalysis = async () => {
    setShowAIModal(true);
  };

  const runAIAnalysis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;
    if (!stats) { setAnalysisError('Dashboard statistics are unavailable. Load them before running an analysis.'); return; }

    setAnalysisError('');
    setAiAnalysisLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/ai/recommendations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          procurementData: {
            stats: stats,
            ...analysisForm,
            timestamp: new Date().toISOString()
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiResults(data.data);
      } else {
        setAnalysisError('Analysis could not be completed. Check the AI service configuration and try again.');
      }
    } catch (error) {
      setAnalysisError('The AI service could not be reached.');
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const closeAIModal = () => {
    setShowAIModal(false);
    setAiResults(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Procurement Management</h1>
              <p className="text-gray-600">Welcome back, {user?.email}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Role: {user?.role}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">V</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Vendors</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats?.totalVendors || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">B</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Bids</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats?.activeBids || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">P</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Approvals</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats?.pendingApprovals || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">C</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats?.completedProcurements || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">$</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Monthly Spending</dt>
                    <dd className="text-lg font-medium text-gray-900">${stats?.monthlySpending?.toLocaleString() || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">%</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Compliance Score</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats?.complianceScore || 0}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/vendors"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Manage Vendors
              </Link>
              <Link
                href="/bids"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                View Bids
              </Link>
              <Link
                href="/compliance"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Compliance
              </Link>
              <button 
                onClick={handleAIAnalysis}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                AI Analysis
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="text-sm text-gray-600">
              <p>• New vendor registration from ABC Corp</p>
              <p>• Bid submitted for IT Equipment procurement</p>
              <p>• Compliance review completed for Project Alpha</p>
              <p>• Monthly spending report generated</p>
            </div>
          </div>
        </div>
      </main>

      {/* AI Analysis Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">AI Analysis</h3>
                <button
                  onClick={closeAIModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {!aiResults ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">Choose a sample to fill every field, then review it before running the analysis.</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">{analysisPresets.map(preset => <button key={preset.analysisType} type="button" onClick={() => { setAnalysisForm({ analysisType: preset.analysisType, focus: preset.focus, context: preset.context, constraints: preset.constraints }); setAnalysisError(''); }} className="rounded border border-gray-300 p-3 text-left text-sm hover:bg-gray-50">{preset.label}</button>)}</div>
                  <form onSubmit={runAIAnalysis} className="space-y-3">
                    <label className="block text-sm font-medium">Analysis type<select required value={analysisForm.analysisType} onChange={event => setAnalysisForm({ ...analysisForm, analysisType: event.target.value })} className="mt-1 block w-full rounded border p-2"><option value="">Choose an analysis</option>{analysisPresets.map(preset => <option key={preset.analysisType} value={preset.analysisType}>{preset.label}</option>)}</select></label>
                    <label className="block text-sm font-medium">Focus<textarea required value={analysisForm.focus} onChange={event => setAnalysisForm({ ...analysisForm, focus: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label>
                    <label className="block text-sm font-medium">Context (optional)<textarea value={analysisForm.context} onChange={event => setAnalysisForm({ ...analysisForm, context: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label>
                    <label className="block text-sm font-medium">Constraints (optional)<textarea value={analysisForm.constraints} onChange={event => setAnalysisForm({ ...analysisForm, constraints: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label>
                    {!stats && <p role="status" className="text-sm text-amber-700">Dashboard statistics are required and currently unavailable.</p>}
                    {analysisError && <p role="alert" className="text-sm text-red-700">{analysisError}</p>}
                    <button type="submit" disabled={aiAnalysisLoading || !stats} className="rounded bg-purple-600 px-4 py-2 text-white disabled:opacity-50">Run analysis</button>
                  </form>
                  
                  {aiAnalysisLoading && (
                    <div className="mt-4 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Running AI analysis...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Analysis Results</h4>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <AIResponseReport value={aiResults}/>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setAiResults(null)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 mr-2"
                    >
                      Run Another Analysis
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
