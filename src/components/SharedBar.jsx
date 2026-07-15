// Publish/fetch a document to the shared team store (Netlify Blobs).
import { useEffect, useState } from 'react';
import { sharedGet, sharedPut } from '../data.jsx';

function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function SharedBar({ blobKey, getLocal, applyRemote, label = 'plan' }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [flash, setFlash] = useState(null);

  const refresh = async (silent) => {
    try { const doc = await sharedGet(blobKey); setInfo(doc); setErr(null); return doc; }
    catch (e) { if (!silent) setErr(String(e.message || e)); return null; }
  };
  useEffect(() => { refresh(true); }, [blobKey]);

  const publish = async () => {
    setBusy(true); setErr(null); setFlash(null);
    try {
      const r = await sharedPut(blobKey, getLocal());
      setInfo({ data: getLocal(), author: r.author, updatedAt: r.updatedAt });
      setFlash('Published — the team now sees this version.');
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };
  const pull = async () => {
    setBusy(true); setErr(null); setFlash(null);
    const doc = await refresh();
    if (doc?.data) { applyRemote(doc.data); setFlash(`Loaded the shared ${label} (${doc.author}, ${ago(doc.updatedAt)}).`); }
    else if (doc === null && !err) setErr(`Nothing published yet — be the first to publish the ${label}.`);
    setBusy(false);
  };

  return (
    <div className="sharedbar noprint">
      <span className="pill" title="Stored with the site on Netlify — everyone with the link shares one copy">☁ Team {label}</span>
      <span className="sub" style={{ fontSize: 11.8 }}>
        {info ? <>shared version: <b>{info.author}</b>, {ago(info.updatedAt)}</> : 'no shared version found yet'}
      </span>
      <button className="btn sm" disabled={busy} onClick={publish}>↑ Publish mine</button>
      <button className="btn sm" disabled={busy} onClick={pull}>↓ Load shared</button>
      {busy && <span className="spinner" />}
      {flash && <span style={{ color: 'var(--green)', fontSize: 11.8 }}>{flash}</span>}
      {err && <span style={{ color: 'var(--crimson)', fontSize: 11.8 }}>{err}</span>}
    </div>
  );
}
