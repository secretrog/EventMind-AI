import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ChatPage from './pages/ChatPage';
import OrganizerDashboard from './pages/OrganizerDashboard';
import QRPage from './pages/QRPage';
import ReportFormPage from './pages/ReportFormPage';
import './index.css';

function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '14px',
            background: '#1e1b4b',
            color: '#e0e7ff',
            border: '1px solid rgba(99,102,241,0.3)',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<OrganizerDashboard />} />
        <Route path="/dashboard" element={<OrganizerDashboard />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/qr" element={<QRPage />} />
        <Route path="/report" element={<ReportFormPage />} />
      </Routes>
    </Router>
  );
}

export default App;
