import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { DataProvider, useData } from './data.jsx';
import Home from './pages/Home.jsx';
import Mission from './pages/Mission.jsx';
import Area from './pages/Area.jsx';
import Vmost from './pages/Vmost.jsx';
import Connections from './pages/Connections.jsx';
import Simulator from './pages/Simulator.jsx';
import Ask from './pages/Ask.jsx';
import './styles.css';

function Nav() {
  const link = ({ isActive }) => 'navlink' + (isActive ? ' active' : '');
  const sub = ({ isActive }) => 'navlink sub' + (isActive ? ' active' : '');
  return (
    <nav className="side">
      <div className="brand">
        <div className="dot">🛰️</div>
        <h1>Mission Control<small>NE &amp; Coastal</small></h1>
      </div>
      <NavLink to="/" end className={link}>⌂ Overview</NavLink>
      <div className="navgroup">Mission North East</div>
      <NavLink to="/mission/ne" className={link}>Mission NE</NavLink>
      <NavLink to="/area/sunderland" className={sub}>Sunderland</NavLink>
      <NavLink to="/area/south-tyneside" className={sub}>South Tyneside</NavLink>
      <div className="navgroup">Mission Coastal</div>
      <NavLink to="/mission/coastal" className={link}>Mission Coastal</NavLink>
      <NavLink to="/area/scarborough" className={sub}>Scarborough</NavLink>
      <NavLink to="/area/hastings" className={sub}>Hastings</NavLink>
      <div className="navgroup">Strategy</div>
      <NavLink to="/vmost" className={link}>◇ VMOST Planner</NavLink>
      <NavLink to="/connections" className={link}>◉ Connections</NavLink>
      <NavLink to="/simulator" className={link}>≋ Impact Simulator</NavLink>
      <NavLink to="/ask" className={link}>✦ Ask</NavLink>
    </nav>
  );
}

function Shell() {
  const { data, error } = useData();
  return (
    <div className="shell">
      <Nav />
      <main className="main">
        {error && <div className="error-box">Failed to load data: {error}</div>}
        {!data && !error && <p style={{ color: '#66748f' }}><span className="spinner" /> Loading mission data…</p>}
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
    </div>
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
