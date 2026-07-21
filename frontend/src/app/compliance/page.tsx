'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ComplianceCheck {
  id: number;
  title: string;
  category: string;
  status: 'passed' | 'failed' | 'pending' | 'warning';
  last_check: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  vendor_id?: number;
  vendor_name?: string;
}

interface ComplianceStats {
  total_checks: number;
  passed: number;
  failed: number;
  pending: number;
  warnings: number;
  compliance_score: number;
  critical_issues: number;
}

export default function CompliancePage() {
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCheck, setNewCheck] = useState({
    title: '',
    category: '',
    description: '',
    severity: 'medium' as ComplianceCheck['severity'],
    vendor_name: ''
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchComplianceData(token);
  }, [router]);

  const fetchComplianceData = async (token: string) => {
    try {
      const [checksResponse, statsResponse] = await Promise.all([
        fetch('http://localhost:3001/api/compliance/checks', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/compliance/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (checksResponse.ok) {
        const checksData = await checksResponse.json();
        setChecks(checksData.checks || []);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    if (!token) return;

    try {
      const response = await fetch('http://localhost:3001/api/compliance/checks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCheck),
      });

      if (response.ok) {
        setNewCheck({ title: '', category: '', description: '', severity: 'medium', vendor_name: '' });
        setShowAddForm(false);
        fetchComplianceData(token);
      }
    } catch (error) {
      console.error('Error adding compliance check:', error);
    }
  };

  const handleStatusChange = async (checkId: number, newStatus: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:3001/api/compliance/checks/${checkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchComplianceData(token);
      }
    } catch (error) {
      console.error('Error updating compliance check status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'warning': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filteredChecks = filter === 'all' ? checks : checks.filter(check => check.status === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading compliance data...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Compliance Tracking</h1>
              <p className="text-gray-600">Monitor regulatory compliance and audit trails</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                Add Check
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-900">{stats?.total_checks || 0}</div>
            <div className="text-sm text-gray-600">Total Checks</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">{stats?.passed || 0}</div>
            <div className="text-sm text-gray-600">Passed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">{stats?.failed || 0}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600">{stats?.warnings || 0}</div>
            <div className="text-sm text-gray-600">Warnings</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-indigo-600">{stats?.compliance_score || 0}%</div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
        </div>

        {/* Add Check Form */}
        {showAddForm && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Compliance Check</h3>
            <form onSubmit={handleAddCheck} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newCheck.title}
                    onChange={(e) => setNewCheck({...newCheck, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    required
                    value={newCheck.category}
                    onChange={(e) => setNewCheck({...newCheck, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Category</option>
                    <option value="Financial">Financial</option>
                    <option value="Legal">Legal</option>
                    <option value="Security">Security</option>
                    <option value="Quality">Quality</option>
                    <option value="Environmental">Environmental</option>
                    <option value="Data Protection">Data Protection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Severity
                  </label>
                  <select
                    value={newCheck.severity}
                    onChange={(e) => setNewCheck({...newCheck, severity: e.target.value as 'low' | 'medium' | 'high' | 'critical'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCheck.vendor_name}
                    onChange={(e) => setNewCheck({...newCheck, vendor_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  required
                  rows={3}
                  value={newCheck.description}
                  onChange={(e) => setNewCheck({...newCheck, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add Check
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { key: 'all', label: 'All Checks' },
                { key: 'passed', label: 'Passed' },
                { key: 'failed', label: 'Failed' },
                { key: 'pending', label: 'Pending' },
                { key: 'warning', label: 'Warnings' }
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

        {/* Compliance Checks List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Compliance Checks ({filteredChecks.length})
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Track and monitor regulatory compliance across all vendors and processes
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            {filteredChecks.length === 0 ? (
              <li className="px-4 py-4 text-center text-gray-500">
                No compliance checks found. Click "Add Check" to get started.
              </li>
            ) : (
              filteredChecks.map((check) => (
                <li key={check.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium text-gray-900">{check.title}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(check.severity)}`}>
                            {check.severity}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(check.status)}`}>
                            {check.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
                        <div>
                          <strong>Category:</strong> {check.category}
                        </div>
                        <div>
                          <strong>Last Check:</strong> {new Date(check.last_check).toLocaleDateString()}
                        </div>
                        <div>
                          <strong>Vendor:</strong> {check.vendor_name || 'System-wide'}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <p>{check.description}</p>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <select
                        value={check.status}
                        onChange={(e) => handleStatusChange(check.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                        <option value="warning">Warning</option>
                      </select>
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
