// Smoke test: every page renders without throwing, with the real data files.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import fs from 'node:fs';
import React from 'react';
import { DataProvider, useData } from './src/data.jsx';
import Home from './src/pages/Home.jsx';
import Mission from './src/pages/Mission.jsx';
import Area from './src/pages/Area.jsx';
import Vmost from './src/pages/Vmost.jsx';
import Connections from './src/pages/Connections.jsx';
import Simulator from './src/pages/Simulator.jsx';
import Ask from './src/pages/Ask.jsx';

const md = JSON.parse(fs.readFileSync('./public/data/mission_data.json', 'utf8'));
const conn = JSON.parse(fs.readFileSync('./public/data/connections.json', 'utf8'));

beforeAll(() => {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    const body = u.includes('/api/plans') ? null : u.includes('connections') ? conn : md;
    return Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(body),
    });
  });
});

// Mirrors the gate in main.jsx: routes only render once data has loaded.
function Gate({ children }) {
  const { data, connections } = useData();
  if (!data || !connections) return null;
  return children;
}

async function renderAt(path) {
  let out;
  await act(async () => {
    out = render(
      <DataProvider>
        <MemoryRouter initialEntries={[path]}>
          <Gate>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mission/:id" element={<Mission />} />
            <Route path="/area/:id" element={<Area />} />
            <Route path="/vmost" element={<Vmost />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/ask" element={<Ask />} />
          </Routes>
          </Gate>
        </MemoryRouter>
      </DataProvider>
    );
  });
  return out;
}

// DataProvider gates children rendering on fetch; pages themselves assume data present.
// Wrap pages so they render only when data exists.
vi.mock('./src/data.jsx', async (orig) => {
  const mod = await orig();
  return mod;
});

describe('Mission Control pages', () => {
  it('Home renders', async () => {
    const { container } = await renderAt('/');
    await waitFor(() => expect(container.textContent).toContain('place-based strategy'));
    expect(container.textContent).toContain('Sunderland');
  });
  it('Mission NE renders', async () => {
    const { container } = await renderAt('/mission/ne');
    await waitFor(() => expect(container.textContent).toContain('Mission North East'));
    expect(container.textContent).toContain('South Tyneside');
  });
  it('Mission Coastal renders', async () => {
    const { container } = await renderAt('/mission/coastal');
    await waitFor(() => expect(container.textContent).toContain('Scarborough'));
    expect(container.textContent).toContain('Hastings');
  });
  for (const area of ['sunderland', 'south-tyneside', 'scarborough', 'hastings']) {
    it(`Area ${area} renders`, async () => {
      const { container } = await renderAt(`/area/${area}`);
      await waitFor(() => expect(container.textContent).toContain('Performance trends'));
      expect(container.textContent).toContain('Secondary schools');
    });
  }
  it('VMOST renders with seed and expands', async () => {
    const { container } = await renderAt('/vmost');
    await waitFor(() => expect(container.textContent).toContain('VMOST Planner'));
    expect(container.textContent).toContain('Narrow the gap');
    expect(container.textContent).toContain('Add Objective');
  });
  it('Connections renders canvas', async () => {
    const { container } = await renderAt('/connections');
    await waitFor(() => expect(container.querySelector('canvas.conn-canvas')).toBeTruthy());
    expect(container.textContent).toContain('Add card');
  });
  it('Simulator renders and models', async () => {
    const { container } = await renderAt('/simulator');
    await waitFor(() => expect(container.textContent).toContain('Impact Simulator'));
    expect(container.textContent).toContain('Attainment 8 trajectory');
    expect(container.textContent).toContain('Save scenario');
    expect(container.textContent).toContain('Saved scenarios');
  });
  it('VMOST has team share + print controls', async () => {
    const { container } = await renderAt('/vmost');
    await waitFor(() => expect(container.textContent).toContain('Publish mine'));
    expect(container.textContent).toContain('Expand all');
    expect(container.textContent).toContain('Print / PDF');
  });
  it('Ask renders suggestions', async () => {
    const { container } = await renderAt('/ask');
    await waitFor(() => expect(container.textContent).toContain('Ask the data'));
  });
});
