import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Nav from './components/Nav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import WorkflowDetail from './pages/WorkflowDetail';
import Tasks from './pages/Tasks';
import Automations from './pages/Automations';
import AIAnalyze from './pages/AIAnalyze';
import AIGenerate from './pages/AIGenerate';
import AIStream from './pages/AIStream';
import AIHistory from './pages/AIHistory';
import AIPrioritize from './pages/AIPrioritize';
import AIAnomalies from './pages/AIAnomalies';
import AISuggestRules from './pages/AISuggestRules';
import Templates from './pages/Templates';
import AIProcessMining from './pages/AIProcessMining';
import AIRefineWorkflow from './pages/AIRefineWorkflow';
import Approvals from './pages/Approvals';
import TaskDependencies from './pages/TaskDependencies';
import RPAIntegrations from './pages/RPAIntegrations';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/workflows" element={<Protected><Workflows /></Protected>} />
        <Route path="/workflows/:id" element={<Protected><WorkflowDetail /></Protected>} />
        <Route path="/tasks" element={<Protected><Tasks /></Protected>} />
        <Route path="/automations" element={<Protected><Automations /></Protected>} />
        <Route path="/templates" element={<Protected><Templates /></Protected>} />
        <Route path="/ai/analyze" element={<Protected><AIAnalyze /></Protected>} />
        <Route path="/ai/generate" element={<Protected><AIGenerate /></Protected>} />
        <Route path="/ai/stream" element={<Protected><AIStream /></Protected>} />
        <Route path="/ai/history" element={<Protected><AIHistory /></Protected>} />
        <Route path="/ai/prioritize" element={<Protected><AIPrioritize /></Protected>} />
        <Route path="/ai/anomalies" element={<Protected><AIAnomalies /></Protected>} />
        <Route path="/ai/suggest-rules" element={<Protected><AISuggestRules /></Protected>} />
        <Route path="/ai/process-mining" element={<Protected><AIProcessMining /></Protected>} />
        <Route path="/ai/refine-workflow" element={<Protected><AIRefineWorkflow /></Protected>} />
        <Route path="/approvals" element={<Protected><Approvals /></Protected>} />
        <Route path="/task-dependencies" element={<Protected><TaskDependencies /></Protected>} />
        <Route path="/rpa-integrations" element={<Protected><RPAIntegrations /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
