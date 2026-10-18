import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Overview from './pages/Overview/Overview.jsx';
import AIWorkspace from './pages/AIWorkspace/AIWorkspace.jsx';
import './index.css';

const isOverview = window.location.pathname.replace(/\/+$/, '') === '/overview';
const isAI = window.location.pathname.replace(/\/+$/, '') === '/ai';
const Page = isAI ? AIWorkspace : isOverview ? Overview : App;

document.title = isAI ? 'RequestFlow · Receipt inbox' : isOverview ? 'Requestflow · Live overview' : 'RequestFlow';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
