import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Home from './pages/Home';
import Settings from './pages/Settings';
import History from './pages/History';
import AgentDetail from './pages/AgentDetail';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history" element={<History />} />
          <Route path="/agent/:name" element={<AgentDetail />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
