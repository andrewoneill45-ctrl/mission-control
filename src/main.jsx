import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { DataProvider, useData } from './data.jsx';
import Home from './pages/Home.jsx';
import Mission from './pages/Mission.jsx';
import Area from './pages/Area.jsx';
import Vmost from './pages/Vmost.jsx';
import Connections from './pages/Connections.jsx';
import Simulator from './pages/Simulator.jsx';
import Ask from './pages/Ask.jsx';
import './styles.css';

function MissionMenu({ id, label, coastal, areas }) {
  const loc = useLocation();
  const active = loc.pathname.startsWith(`/mission/${id}`) || areas.some((a) => loc.pathname === `/area/${a.path}`);
  return (
    <div className="navmenu">
      <NavLink to={`/mission/${id}`} className={`navlink ${active ? 'active' : ''} ${coastal ? 'coastal' : ''}`}>
        {label} <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </NavLink>
      <div className="dropdown">
        <NavLink to={`/mission/${id}`} className={({ isActive }) => isActive ? 'active' : ''}>Mission overview</NavLink>
        <div className="dd-head">Areas</div>
        {areas.map((a) => (
          <NavLink key={a.path} to={`/area/${a.path}`} className={({ isActive }) => isActive ? 'active' : ''}>{a.name}</NavLink>
        ))}
      </div>
    </div>
  );
}

function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mc-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f9d8a" />
          <stop offset="1" stopColor="#2f6fdb" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#mc-g)" />
      <circle cx="16" cy="16" r="6.5" stroke="#fff" strokeWidth="1.6" opacity="0.9" />
      <circle cx="16" cy="16" r="2.1" fill="#fff" />
      <path d="M4.5 21.5 C 9 26.5, 23 26.5, 27.5 21.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" fill="none" />
      <circle cx="25.1" cy="8.2" r="1.9" fill="#fff" />
    </svg>
  );
}

function Nav() {
  const link = ({ isActive }) => 'navlink' + (isActive ? ' active' : '');
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <NavLink to="/" className="brand">
          <Logo />
          <h1>Mission Control<small>NE &amp; Coastal</small></h1>
        </NavLink>
        <NavLink to="/" end className={link}>Overview</NavLink>
        <MissionMenu id="ne" label="Mission NE" areas={[
          { path: 'sunderland', name: 'Sunderland' },
          { path: 'south-tyneside', name: 'South Tyneside' },
        ]} />
        <MissionMenu id="coastal" label="Mission Coastal" coastal areas={[
          { path: 'scarborough', name: 'Scarborough' },
          { path: 'hastings', name: 'Hastings' },
        ]} />
        <span style={{ flex: 1 }} />
        <NavLink to="/vmost" className={link}>VMOST</NavLink>
        <NavLink to="/connections" className={link}>Connections</NavLink>
        <NavLink to="/simulator" className={link}>Simulator</NavLink>
        <NavLink to="/ask" className={link}>Ask&nbsp;✦</NavLink>
      </div>
    </header>
  );
}

function Shell() {
  const { data, error } = useData();
  return (
    <>
      <Nav />
      <main className="main">
        {error && <div className="error-box">Failed to load data: {error}</div>}
        {!data && !error && <p style={{ color: 'var(--ink3)' }}><span className="spinner" /> Loading mission data…</p>}
        {data && (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mission/:id" element={<Mission />} />
            <Route path="/area/:id" element={<Area />} />
            <Route path="/vmost" element={<Vmost />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/ask" element={<Ask />} />
          </Routes>
        )}
      </main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DataProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </DataProvider>
  </React.StrictMode>
);
