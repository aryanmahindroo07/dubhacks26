import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Overview from './pages/Overview/Overview.jsx';
import './index.css';

const isOverview = window.location.pathname.replace(/\/+$/, '') === '/overview';
const Page = isOverview ? Overview : App;

document.title = isOverview ? 'Requestflow · Overview' : 'RequestFlow';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
