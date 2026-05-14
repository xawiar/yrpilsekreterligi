import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GeminiKeyPool from '../services/GeminiKeyPool';

/**
 * Live Ops Status — Seçim günü canlı durum paneli.
 * - Son 5/15/60 dk girilen sandık sonuçları
 * - GeminiKeyPool havuz durumu (aktif/cooldown/istatistik)
 * - Cloud Function sağlığı (manifest, publicElectionResults ping)
 * - Manifest URL latency
 *
 * Sadece admin görür.
 */
const COLORS = {
  primary: '#dc2626',
  primaryDark: '#b91c1c',
  primaryLight: '#fef2f2',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  gray: '#6b7280',
  bg: '#f9fafb',
};

const Card = ({ title, children, color }) => (
  <div style={{
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: color || COLORS.primary,
  }}>
    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 12 }}>
      {title}
    </h3>
    {children}
  </div>
);

const StatBox = ({ label, value, sub, color }) => (
  <div style={{ flex: 1, padding: 12, background: COLORS.bg, borderRadius: 8 }}>
    <div style={{ fontSize: 11, color: COLORS.gray, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: color || '#111827', marginTop: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 2 }}>{sub}</div>}
  </div>
);

const LiveOpsStatusPage = () => {
  const [tickCount, setTickCount] = useState(0);
  const [recentResults, setRecentResults] = useState([]);
  const [poolStatus, setPoolStatus] = useState({ total: 0, available: 0, cooldown: 0, stats: {} });
  const [functionPings, setFunctionPings] = useState({ manifest: null, publicElection: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auto refresh every 10 seconds
  useEffect(() => {
    const tick = () => setTickCount((c) => c + 1);
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  // Real-time election_results listener (last hour)
  useEffect(() => {
    let unsubscribe = null;
    (async () => {
      try {
        setLoading(true);
        const { collection, query, where, onSnapshot, Timestamp } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        if (!db) return;

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const q = query(
          collection(db, 'election_results'),
          where('created_at', '>=', Timestamp.fromDate(oneHourAgo))
        );

        unsubscribe = onSnapshot(q, (snap) => {
          const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRecentResults(results);
          setLoading(false);
        }, (err) => {
          console.error('Live ops listener error:', err);
          setError(err.message);
          setLoading(false);
        });
      } catch (e) {
        console.error('Live ops setup error:', e);
        setError(e.message);
        setLoading(false);
      }
    })();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // Pool status update
  useEffect(() => {
    setPoolStatus(GeminiKeyPool.getStatus());
  }, [tickCount]);

  // Cloud Function pings (every 30sn)
  useEffect(() => {
    const ping = async (url, key) => {
      const start = performance.now();
      try {
        const r = await fetch(url, { method: 'GET', cache: 'no-cache' });
        const ms = Math.round(performance.now() - start);
        setFunctionPings((prev) => ({ ...prev, [key]: { ok: r.ok, ms, status: r.status } }));
      } catch (err) {
        setFunctionPings((prev) => ({ ...prev, [key]: { ok: false, ms: null, error: err.message } }));
      }
    };
    const run = () => {
      ping('/manifest.json', 'manifest');
      ping('https://europe-west1-spilsekreterligi.cloudfunctions.net/publicElectionResults', 'publicElection');
    };
    run();
    const id = setInterval(run, 30000);
    return () => clearInterval(id);
  }, []);

  // Counts
  const now = Date.now();
  const counts = recentResults.reduce(
    (acc, r) => {
      const t = r.created_at?.toDate ? r.created_at.toDate().getTime() :
                r.created_at?.seconds ? r.created_at.seconds * 1000 :
                r.created_at ? new Date(r.created_at).getTime() : 0;
      if (!t) return acc;
      const ageMin = (now - t) / 60000;
      if (ageMin <= 5) acc.last5++;
      if (ageMin <= 15) acc.last15++;
      if (ageMin <= 60) acc.last60++;
      return acc;
    },
    { last5: 0, last15: 0, last60: 0 }
  );

  return (
    <div style={{ padding: 16, maxWidth: 1280, margin: '0 auto', minHeight: '100vh', background: COLORS.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.primary, margin: 0 }}>
            🟢 Canlı Durum Paneli
          </h1>
          <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 4 }}>
            10 saniyede bir yenilenir · Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}
          </div>
        </div>
        <Link to="/" style={{
          padding: '8px 14px', background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 8, textDecoration: 'none', color: '#111827', fontSize: 13, fontWeight: 600
        }}>
          ← Ana Sayfa
        </Link>
      </div>

      {error && (
        <div style={{
          padding: 12, background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, color: '#991b1b', fontSize: 13, marginBottom: 16
        }}>
          ⚠️ Veri çekilirken hata: {error}
        </div>
      )}

      {/* Üst sıra: Veri girişi sayaçları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <Card title="📊 Son 5 Dakika" color={counts.last5 > 0 ? COLORS.success : COLORS.gray}>
          <StatBox label="Yeni Sandık Sonucu" value={loading ? '…' : counts.last5} sub="form girişi" color={COLORS.success} />
        </Card>
        <Card title="📈 Son 15 Dakika" color={COLORS.warning}>
          <StatBox label="Yeni Sandık Sonucu" value={loading ? '…' : counts.last15} sub="form girişi" color={COLORS.warning} />
        </Card>
        <Card title="🕐 Son 1 Saat" color={COLORS.primary}>
          <StatBox label="Toplam Veri Girişi" value={loading ? '…' : counts.last60} sub="form girişi" color={COLORS.primary} />
        </Card>
      </div>

      {/* Gemini Key Pool */}
      <div style={{ marginBottom: 16 }}>
        <Card title="🔑 Gemini API Key Havuzu (Round-Robin)" color={poolStatus.cooldown > 0 ? COLORS.warning : COLORS.success}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <StatBox label="Toplam Key" value={poolStatus.total} />
            <StatBox label="Aktif" value={poolStatus.available} color={COLORS.success} />
            <StatBox label="Cooldown'da" value={poolStatus.cooldown} color={poolStatus.cooldown > 0 ? COLORS.warning : COLORS.gray} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <StatBox label="Toplam İstek" value={poolStatus.stats?.requestCount || 0} />
            <StatBox label="Başarılı" value={poolStatus.stats?.successCount || 0} color={COLORS.success} />
            <StatBox label="429 (Limit)" value={poolStatus.stats?.rateLimitCount || 0} color={COLORS.warning} />
            <StatBox label="Geçersiz Key" value={poolStatus.stats?.invalidKeyCount || 0} color={COLORS.danger} />
          </div>
          {poolStatus.stats?.lastError && (
            <div style={{
              marginTop: 10, padding: 10, background: '#fef3c7', borderRadius: 6,
              fontSize: 12, color: '#92400e'
            }}>
              Son hata: <strong>{poolStatus.stats.lastError.type}</strong> ·{' '}
              {new Date(poolStatus.stats.lastError.at).toLocaleTimeString('tr-TR')}
            </div>
          )}
          {poolStatus.total === 0 && (
            <div style={{
              marginTop: 10, padding: 10, background: '#fef2f2', borderRadius: 6,
              fontSize: 12, color: '#991b1b'
            }}>
              ⚠️ Henüz key havuzu yüklenmedi. OCR butonuna basıldığında ilk key yüklenir.
            </div>
          )}
        </Card>
      </div>

      {/* Cloud Function Sağlık */}
      <div style={{ marginBottom: 16 }}>
        <Card title="☁️ Cloud Function Sağlık" color={
          (functionPings.manifest?.ok && functionPings.publicElection?.ok) ? COLORS.success : COLORS.danger
        }>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <FunctionStat label="Manifest" data={functionPings.manifest} />
            <FunctionStat label="Public Election Results" data={functionPings.publicElection} />
          </div>
        </Card>
      </div>

      {/* Son Veri Girişleri */}
      <div>
        <Card title="📋 Son Veri Girişleri (Son 1 Saat)">
          {recentResults.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: COLORS.gray, fontSize: 13 }}>
              {loading ? 'Yükleniyor…' : 'Son 1 saatte veri girişi yok.'}
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {recentResults
                .sort((a, b) => {
                  const ta = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
                  const tb = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
                  return tb - ta;
                })
                .slice(0, 50)
                .map((r) => {
                  const t = r.created_at?.toDate ? r.created_at.toDate() : null;
                  const ageSec = t ? Math.floor((now - t.getTime()) / 1000) : 0;
                  const ageStr = ageSec < 60 ? `${ageSec}sn önce` :
                                 ageSec < 3600 ? `${Math.floor(ageSec / 60)}dk önce` :
                                 `${Math.floor(ageSec / 3600)}sa önce`;
                  return (
                    <div key={r.id} style={{
                      padding: '8px 0', borderBottom: '1px solid #f3f4f6',
                      fontSize: 13, display: 'flex', justifyContent: 'space-between'
                    }}>
                      <div>
                        <strong>Sandık #{r.ballot_box_id || r.ballotBoxId || '?'}</strong>
                        {' · '}
                        <span style={{ color: COLORS.gray }}>
                          {r.filled_by_ai ? 'AI ile' : 'manuel'}
                          {r.approved_by_chief_observer ? ' · ✅ onaylı' : ' · onay bekliyor'}
                        </span>
                      </div>
                      <div style={{ color: COLORS.gray, fontSize: 12 }}>{ageStr}</div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: COLORS.gray, textAlign: 'center' }}>
        Toplam {recentResults.length} kayıt yüklendi · GeminiKeyPool client-side, sadece mevcut tarayıcı oturumunu yansıtır
      </div>
    </div>
  );
};

const FunctionStat = ({ label, data }) => {
  const COLORS_LOCAL = { ok: '#16a34a', err: '#dc2626', gray: '#6b7280' };
  const color = !data ? COLORS_LOCAL.gray : data.ok ? COLORS_LOCAL.ok : COLORS_LOCAL.err;
  const status = !data ? 'Bekleniyor…' : data.ok ? `${data.ms} ms` : `Hata ${data.status || data.error}`;
  return (
    <div style={{
      padding: 12, background: '#f9fafb', borderRadius: 8,
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 4 }}>{status}</div>
    </div>
  );
};

export default LiveOpsStatusPage;
