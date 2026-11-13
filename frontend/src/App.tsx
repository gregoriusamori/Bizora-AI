import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import PredictiveAnalytics from './pages/PredictiveAnalytics';
import Reports from './pages/Reports';
import AiChat from './pages/AiChat';
import DashboardAnalytics from './pages/DashboardAnalytics';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<DashboardAnalytics view="overview" />} />
      <Route path="/dashboard/sales" element={<DashboardAnalytics view="sales" />} />
      <Route path="/dashboard/profit" element={<DashboardAnalytics view="profit" />} />
      <Route path="/dashboard/products" element={<DashboardAnalytics view="products" />} />
      <Route path="/dashboard/branches" element={<DashboardAnalytics view="branches" />} />
      <Route path="/dashboard/predictive" element={<PredictiveAnalytics />} />
      <Route path="/dashboard/reports" element={<Reports />} />
      <Route path="/dashboard/chat" element={<AiChat />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
