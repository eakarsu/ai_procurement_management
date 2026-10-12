'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AIResponseReport from '../../components/AIResponseReport';

const briefPresets = [
  { label: 'Supplier continuity', prompt: 'Review supplier continuity risks for the current procurement portfolio. Identify evidence gaps, potential impacts, next actions, uncertainty, and decisions requiring human review.' },
  { label: 'Renewal readiness', prompt: 'Prepare a procurement renewal brief. Examine timing, contract evidence, pricing assumptions, approval needs, and practical next actions. Mark any missing source data as unknown.' },
  { label: 'Approval controls', prompt: 'Review purchasing approval controls and audit readiness. Summarize observed risks, evidence still needed, recommended actions, uncertainty, and required human review.' },
];

interface SavedBrief { id: string; input: unknown; output: string; model: string; createdAt: string }

interface AIInsight {
  id: number;
  title: string;
  category: 'vendor' | 'bid' | 'compliance' | 'spending';
  priority: 'low' | 'medium' | 'high' | 'critical';
  insight: string;
  recommendation: string;
  confidence: number;
  created_at: string;
  data_source: string;
}

interface AIAnalysisStats {
  total_insights: number;
  high_priority: number;
  cost_savings_potential: number;
  risk_score: number;
  automation_rate: number;
  prediction_accuracy: number;
}

export default function AIAnalysisPage() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [stats, setStats] = useState<AIAnalysisStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [briefPrompt, setBriefPrompt] = useState('');
  const [briefs, setBriefs] = useState<SavedBrief[]>([]);
  const [selectedBrief, setSelectedBrief] = useState<SavedBrief | null>(null);
  const [briefRunning, setBriefRunning] = useState(false);
  const [briefError, setBriefError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchAIAnalysis(token);
    fetchBriefs(token);
  }, [router]);

  const fetchBriefs = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/ai/runtime-brief/history', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Saved briefs are unavailable');
      const body = await response.json();
      setBriefs(body.results || []);
    } catch {
      setBriefError('Saved briefs could not be loaded.');
    }
  };

  const runBrief = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) { setBriefError('Sign in before generating a brief.'); return; }
    setBriefRunning(true);
    setBriefError('');
    try {
      const response = await fetch('http://localhost:3001/api/ai/runtime-brief', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: briefPrompt }) });
      if (!response.ok) throw new Error('Generation failed');
      const body = await response.json();
      setSelectedBrief({ id: body.id, input: { prompt: briefPrompt }, output: body.response, model: body.model, createdAt: new Date().toISOString() });
      await fetchBriefs(token);
    } catch {
      setBriefError('The AI brief could not be generated. Check the configured service and try again.');
    } finally {
      setBriefRunning(false);
    }
  };

  const fetchAIAnalysis = async (token: string) => {
    try {
      const [insightsResponse, statsResponse] = await Promise.all([
        fetch('http://localhost:3001/api/ai/insights', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/ai/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json();
        setInsights(insightsData.insights || []);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAIAnalysis = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setAnalysisRunning(true);
    try {
      const response = await fetch('http://localhost:3001/api/ai/analyze', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchAIAnalysis(token);
      }
    } catch (error) {
      console.error('Error running AI analysis:', error);
    } finally {
      setAnalysisRunning(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'vendor': return '🏢';
      case 'bid': return '📊';
      case 'compliance': return '✅';
      case 'spending': return '💰';
      default: return '🤖';
    }
  };

  const filteredInsights = filter === 'all' ? insights : insights.filter(insight => insight.category === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AI analysis...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">AI Analysis Dashboard</h1>
              <p className="text-gray-600">Intelligent insights and recommendations for procurement optimization</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={runAIAnalysis}
                disabled={analysisRunning}
                className={`px-4 py-2 rounded-md text-white ${
                  analysisRunning 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {analysisRunning ? 'Running Analysis...' : 'Run New Analysis'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <section className="mb-8 rounded-lg bg-white p-6 shadow" aria-label="Procurement brief">
          <h2 className="text-xl font-semibold">Procurement brief</h2>
          <p className="mt-1 text-sm text-gray-600">Choose a sample to fill the prompt, review it, then generate a brief.</p>
          <div className="mt-4 flex flex-wrap gap-2">{briefPresets.map(preset => <button key={preset.label} type="button" onClick={() => setBriefPrompt(preset.prompt)} className="rounded border border-gray-300 px-3 py-2 text-sm">{preset.label}</button>)}</div>
          <form onSubmit={runBrief} className="mt-4 space-y-3">
            <label className="block text-sm font-medium">Prompt<textarea required value={briefPrompt} onChange={event => setBriefPrompt(event.target.value)} className="mt-1 block w-full rounded border p-3" rows={4} /></label>
            <button type="submit" disabled={briefRunning} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{briefRunning ? 'Generating...' : 'Generate brief'}</button>
          </form>
          {briefError && <p role="alert" className="mt-3 text-sm text-red-700">{briefError}</p>}
          {selectedBrief && <div className="mt-5"><AIResponseReport value={{ result_json: selectedBrief.output, model: selectedBrief.model }} title="Procurement brief" /></div>}
          <h3 className="mt-6 font-semibold">Saved briefs</h3>
          {briefs.length === 0 && <p className="mt-2 text-sm text-gray-600">No saved briefs are available.</p>}
          <ul className="mt-2 space-y-2">{briefs.map(brief => <li key={brief.id}><button type="button" onClick={() => setSelectedBrief(brief)} className="text-left text-sm text-indigo-700 underline">{new Date(brief.createdAt).toLocaleString()} · Procurement brief</button></li>)}</ul>
        </section>
        {/* AI Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-900">{stats?.total_insights || 0}</div>
            <div className="text-sm text-gray-600">Total Insights</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">{stats?.high_priority || 0}</div>
            <div className="text-sm text-gray-600">High Priority</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">${stats?.cost_savings_potential?.toLocaleString() || 0}</div>
            <div className="text-sm text-gray-600">Savings Potential</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">{stats?.risk_score || 0}%</div>
            <div className="text-sm text-gray-600">Risk Score</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{stats?.automation_rate || 0}%</div>
            <div className="text-sm text-gray-600">Automation Rate</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">{stats?.prediction_accuracy || 0}%</div>
            <div className="text-sm text-gray-600">Prediction Accuracy</div>
          </div>
        </div>

        {/* AI Capabilities Overview */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">AI Capabilities</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🧠</span>
                </div>
                <h4 className="font-medium text-gray-900">Smart Vendor Matching</h4>
                <p className="text-sm text-gray-600 mt-1">AI matches vendors to projects based on capabilities and performance</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📈</span>
                </div>
                <h4 className="font-medium text-gray-900">Predictive Analytics</h4>
                <p className="text-sm text-gray-600 mt-1">Forecast spending patterns and identify cost optimization opportunities</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">⚡</span>
                </div>
                <h4 className="font-medium text-gray-900">Risk Assessment</h4>
                <p className="text-sm text-gray-600 mt-1">Automated risk scoring and early warning system for vendor issues</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🔄</span>
                </div>
                <h4 className="font-medium text-gray-900">Process Automation</h4>
                <p className="text-sm text-gray-600 mt-1">Streamline workflows with intelligent automation and decision support</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { key: 'all', label: 'All Insights' },
                { key: 'vendor', label: 'Vendor' },
                { key: 'bid', label: 'Bid' },
                { key: 'compliance', label: 'Compliance' },
                { key: 'spending', label: 'Spending' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* AI Insights List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              AI Insights ({filteredInsights.length})
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Machine learning-powered insights and recommendations for your procurement process
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            {filteredInsights.length === 0 ? (
              <li className="px-4 py-8 text-center text-gray-500">
                <div className="text-4xl mb-4">🤖</div>
                <p>No AI insights available yet. Click "Run New Analysis" to generate insights.</p>
              </li>
            ) : (
              filteredInsights.map((insight) => (
                <li key={insight.id} className="px-4 py-6 hover:bg-gray-50">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <span className="text-xl">{getCategoryIcon(insight.category)}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{insight.title}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(insight.priority)}`}>
                            {insight.priority}
                          </span>
                          <span className="text-sm text-gray-500">
                            {insight.confidence}% confidence
                          </span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-sm text-gray-700 mb-2">
                          <strong>Insight:</strong> {insight.insight}
                        </p>
                        <p className="text-sm text-gray-700">
                          <strong>Recommendation:</strong> {insight.recommendation}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Data Source: {insight.data_source}</span>
                        <span>Generated: {new Date(insight.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
