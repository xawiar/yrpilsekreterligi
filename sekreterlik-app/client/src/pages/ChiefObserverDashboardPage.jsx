import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import ElectionResultForm from '../components/ElectionResultForm';
import ChiefObserverQuickForm from '../components/ChiefObserverQuickForm';
import BallotBoxDocumentsPanel from '../components/BallotBoxDocumentsPanel';
import TrainingMaterialList from '../components/TrainingMaterialList';
import NotificationBell from '../components/NotificationBell';
import NotificationFeed from '../components/NotificationFeed';
import { useAuth } from '../contexts/AuthContext';
import OfflineIndicator from '../components/OfflineIndicator';

/* =====================================================================
 * Başmüşahit Dashboard — sıfırdan tasarım, gerçek desktop layout
 * Header (kompakt) + 4 Stat (kompakt) + Sol(2fr)/Sağ(1fr) flex layout
 * Inline CSS (Tailwind responsive class'ı kullanmadan, %100 garantili)
 * ===================================================================*/

const COLORS = {
  primary: '#dc2626',
  primaryDark: '#b91c1c',
  primaryLight: '#fef2f2',
  text: '#111827',
  textMuted: '#6b7280',
  bg: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
};

const STATUS_META = {
  not_entered: { label: 'Henüz Girilmedi', icon: '⏳', bg: '#e5e7eb', text: '#1f2937' },
  pending: { label: 'Onay Bekliyor', icon: '🟡', bg: '#fef3c7', text: '#78350f' },
  approved: { label: 'Onaylandı', icon: '✅', bg: '#d1fae5', text: '#065f46' },
  rejected: { label: 'Reddedildi — Tekrar Gir', icon: '🔴', bg: '#fee2e2', text: '#7f1d1d' },
};

const StatusBadge = ({ status, prefix, reason }) => {
  const meta = STATUS_META[status] || STATUS_META.not_entered;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: meta.bg, color: meta.text,
      padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    }}>
      <span>{meta.icon}</span>
      {prefix && <span style={{ opacity: 0.8 }}>{prefix}:</span>}
      <span>{meta.label}</span>
      {status === 'rejected' && reason && (
        <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.85, fontSize: 11 }}>· {reason}</span>
      )}
    </span>
  );
};

const StatCard = ({ label, value, color, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: COLORS.card, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .2s',
    }}
    onMouseEnter={(e) => onClick && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
  >
    <div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: color, opacity: 0.15 }} />
  </div>
);

const Card = ({ title, icon, children, padding = 16 }) => (
  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
    {title && (
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`,
        fontWeight: 700, fontSize: 14, color: COLORS.text,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {icon}<span>{title}</span>
      </div>
    )}
    <div style={{ padding }}>{children}</div>
  </div>
);

const ChiefObserverDashboardPage = () => {
  const navigate = useNavigate();
  const { isLoggedIn, userRole, user, logout, loading: authLoading } = useAuth();

  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedElection, setSelectedElection] = useState(null);
  const [showResultForm, setShowResultForm] = useState(false);
  // Quick form (sadeleştirilmiş) varsayılan; "detaylı moda geç" linkiyle eski forma çıkış
  const [useAdvancedForm, setUseAdvancedForm] = useState(false);
  const [electionResults, setElectionResults] = useState({});
  const [institutionSupervisor, setInstitutionSupervisor] = useState(null);
  const [regionSupervisor, setRegionSupervisor] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const recentlyHandledRef = useRef(new Map());
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [activeTab, setActiveTab] = useState('elections');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Auth
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn || !user || (userRole !== 'chief_observer' && userRole !== 'musahit' && !user?.observerId)) {
      navigate('/login?type=chief-observer', { replace: true });
    }
  }, [isLoggedIn, userRole, user, navigate, authLoading]);

  const loadPendingApprovals = useCallback(async () => {
    if (!isLoggedIn || !user || (userRole !== 'chief_observer' && userRole !== 'musahit' && !user?.observerId)) return;
    try {
      setLoadingApprovals(true);
      const ballotBoxId = user.ballotBoxId || user.ballot_box_id;
      const data = await ApiService.getPendingElectionResults(ballotBoxId);
      if (data && data.results) {
        const now = Date.now();
        const filtered = data.results.filter((r) => {
          const key = `${String(r.id)}_${r.category || ''}`;
          const ts = recentlyHandledRef.current.get(key);
          if (ts && now - ts < 5000) return false;
          if (ts) recentlyHandledRef.current.delete(key);
          return true;
        });
        setPendingApprovals(filtered);
      }
    } catch (e) {
      console.error('Error loading pending approvals:', e);
    } finally {
      setLoadingApprovals(false);
    }
  }, [isLoggedIn, userRole, user]);

  // Data load
  useEffect(() => {
    if (!isLoggedIn || !user || (userRole !== 'chief_observer' && userRole !== 'musahit' && !user?.observerId)) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const all = await ApiService.getElections();
        if (!mounted) return;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30); cutoff.setHours(0, 0, 0, 0);
        const active = all
          .filter(e => {
            if (e.status === 'closed') return false;
            if (!e.date) return true;
            const d = new Date(e.date); d.setHours(0, 0, 0, 0);
            return d >= cutoff;
          })
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        setElections(active);

        const ballotBoxId = user.ballotBoxId || user.ballot_box_id;
        const allRes = await Promise.all(
          active.map(e => ApiService.getElectionResults(e.id, ballotBoxId).then(r => ({ e, r })).catch(() => ({ e, r: [] })))
        );
        const map = {};
        allRes.forEach(({ e, r }) => { if (r && r.length > 0) map[e.id] = r[0]; });
        setElectionResults(map);

        // Üst sorumlular
        if (ballotBoxId) {
          try {
            const [boxes, coords, regions] = await Promise.all([
              ApiService.getBallotBoxes(),
              ApiService.getElectionCoordinators(),
              ApiService.getElectionRegions(),
            ]);
            const bb = boxes.find(b => String(b.id) === String(ballotBoxId));
            if (bb) {
              if (bb.institution_name) {
                const ins = coords.find(c =>
                  c.role === 'institution_supervisor' &&
                  c.institution_name === bb.institution_name &&
                  (bb.district_id && c.district_id ? String(c.district_id) === String(bb.district_id) : true)
                );
                if (ins) setInstitutionSupervisor(ins);
              }
              const nb = bb.neighborhood_id, vl = bb.village_id;
              for (const region of regions) {
                const nbIds = Array.isArray(region.neighborhood_ids) ? region.neighborhood_ids : (region.neighborhood_ids ? JSON.parse(region.neighborhood_ids) : []);
                const vlIds = Array.isArray(region.village_ids) ? region.village_ids : (region.village_ids ? JSON.parse(region.village_ids) : []);
                if ((nb && nbIds.includes(nb)) || (vl && vlIds.includes(vl))) {
                  if (region.supervisor_id) {
                    const reg = coords.find(c => String(c.id) === String(region.supervisor_id));
                    if (reg) setRegionSupervisor(reg);
                  }
                  break;
                }
              }
            }
          } catch (e) { console.error('Supervisor fetch error:', e); }
        }
      } catch (e) {
        console.error(e);
        if (mounted) setError('Veriler yüklenirken hata oluştu');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    loadPendingApprovals();
    return () => { mounted = false; };
  }, [user, isLoggedIn, userRole, loadPendingApprovals]);

  // Real-time listener
  useEffect(() => {
    const ballotBoxId = user?.ballotBoxId || user?.ballot_box_id;
    if (!isLoggedIn || !ballotBoxId) return;
    let unsubscribe = null;
    (async () => {
      try {
        const { collection, query, where, onSnapshot } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        if (!db) return;
        const q = query(collection(db, 'election_results'), where('ballot_box_id', '==', String(ballotBoxId)));
        unsubscribe = onSnapshot(q, (snap) => {
          loadPendingApprovals();
          const m = {};
          snap.docs.forEach(d => { const data = d.data(); if (data.election_id) m[data.election_id] = { id: d.id, ...data }; });
          setElectionResults(m);
        }, (err) => console.error('Real-time error:', err));
      } catch (e) { console.error('Subscription failed:', e); }
    })();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [isLoggedIn, user?.ballotBoxId, user?.ballot_box_id, loadPendingApprovals]);

  // Handlers
  const handleElectionClick = useCallback((e) => {
    setSelectedElection(e);
    setShowResultForm(true);
    setUseAdvancedForm(false); // her açılışta sade moda dön
  }, []);
  const handleCloseForm = useCallback(() => {
    setShowResultForm(false);
    setSelectedElection(null);
    setUseAdvancedForm(false);
  }, []);
  const handleFormSuccess = useCallback(() => {
    if (selectedElection && user) {
      ApiService.getElectionResults(selectedElection.id, user.ballotBoxId || user.ballot_box_id)
        .then(r => { if (r && r.length > 0) setElectionResults(prev => ({ ...prev, [selectedElection.id]: r[0] })); })
        .catch(console.error);
    }
    setShowResultForm(false); setSelectedElection(null);
  }, [selectedElection, user]);
  const handleLogout = useCallback(() => { logout(); navigate('/login?type=chief-observer', { replace: true }); }, [navigate, logout]);

  const handleApprove = useCallback(async (resultId, category = null) => {
    const k = `${String(resultId)}_${category || ''}`;
    recentlyHandledRef.current.set(k, Date.now());
    setTimeout(() => recentlyHandledRef.current.delete(k), 6000);
    setPendingApprovals(prev => prev.filter(p => !(String(p.id) === String(resultId) && ((p.category || '') === (category || '')))));
    const label = category === 'cb' ? 'CB sonucu' : (category === 'mv' ? 'MV sonucu' : 'Sonuç');
    try {
      await ApiService.approveElectionResult(resultId, category);
      setMessage(`${label} başarıyla onaylandı`); setMessageType('success');
    } catch (err) {
      console.error(err); setMessage(err.message || 'Onaylama hatası'); setMessageType('error');
      await loadPendingApprovals();
    }
  }, [loadPendingApprovals]);

  const handleReject = useCallback(async (resultId, reason, category = null) => {
    const k = `${String(resultId)}_${category || ''}`;
    recentlyHandledRef.current.set(k, Date.now());
    setTimeout(() => recentlyHandledRef.current.delete(k), 6000);
    setPendingApprovals(prev => prev.filter(p => !(String(p.id) === String(resultId) && ((p.category || '') === (category || '')))));
    const label = category === 'cb' ? 'CB sonucu' : (category === 'mv' ? 'MV sonucu' : 'Sonuç');
    try {
      await ApiService.rejectElectionResult(resultId, reason, category);
      setMessage(`${label} silindi. Müşahit yeniden girebilir.`); setMessageType('success');
    } catch (err) {
      console.error(err); setMessage(err.message || 'Silme hatası'); setMessageType('error');
      await loadPendingApprovals();
    }
  }, [loadPendingApprovals]);

  // Helpers
  const getTypeLabel = (t) => ({ yerel: 'Yerel', genel: 'Genel', cb: 'Cumhurbaşkanlığı' }[t] || t);
  const formatDate = (s) => { try { return s ? new Date(s).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'; } catch { return '-'; } };
  const getDaysUntil = (s) => { if (!s) return null; const t = new Date(); t.setHours(0,0,0,0); const d = new Date(s); d.setHours(0,0,0,0); return Math.ceil((d-t)/86400000); };

  const getCategoryStatus = (r, category) => {
    if (!r) return { status: 'not_entered' };
    if (category === 'cb') {
      if (r.cb_status === 'rejected') return { status: 'rejected', reason: r.cb_rejection_reason };
      const has = (r.cb_votes && Object.keys(r.cb_votes).length > 0) || !!r.signed_protocol_photo;
      if (!has) return { status: 'not_entered' };
      if (r.cb_status === 'approved') return { status: 'approved' };
      return { status: 'pending' };
    }
    if (category === 'mv') {
      if (r.mv_status === 'rejected') return { status: 'rejected', reason: r.mv_rejection_reason };
      const has = (r.mv_votes && Object.keys(r.mv_votes).length > 0) || !!r.signed_mv_protocol_photo;
      if (!has) return { status: 'not_entered' };
      if (r.mv_status === 'approved') return { status: 'approved' };
      return { status: 'pending' };
    }
    if (r.approval_status === 'rejected') return { status: 'rejected', reason: r.rejection_reason };
    const any =
      (r.mayor_votes && Object.keys(r.mayor_votes).length > 0) ||
      (r.provincial_assembly_votes && Object.keys(r.provincial_assembly_votes).length > 0) ||
      (r.municipal_council_votes && Object.keys(r.municipal_council_votes).length > 0) ||
      (r.referendum_votes && Object.values(r.referendum_votes || {}).some(v => v > 0)) ||
      (r.cb_votes && Object.keys(r.cb_votes).length > 0) ||
      (r.mv_votes && Object.keys(r.mv_votes).length > 0) ||
      !!r.signed_protocol_photo || !!r.signed_mv_protocol_photo;
    if (!any) return { status: 'not_entered' };
    if (r.approval_status === 'approved') return { status: 'approved' };
    return { status: 'pending' };
  };

  const getElectionStatus = (e) => {
    const r = electionResults[e.id];
    if (e?.type === 'genel') return { type: 'multi', cb: getCategoryStatus(r, 'cb'), mv: getCategoryStatus(r, 'mv') };
    return { type: 'single', overall: getCategoryStatus(r, null) };
  };

  const hasResult = (id) => {
    const r = electionResults[id]; if (!r) return false;
    const e = elections.find(x => String(x.id) === String(id)); if (!e) return false;
    if (e.type === 'genel') {
      const cb = getCategoryStatus(r, 'cb').status, mv = getCategoryStatus(r, 'mv').status;
      return ['pending', 'approved'].includes(cb) && ['pending', 'approved'].includes(mv);
    }
    return ['pending', 'approved'].includes(getCategoryStatus(r, null).status);
  };

  const completedCount = elections.filter(e => hasResult(e.id)).length;
  const pendingCount = elections.length - completedCount;

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, border: `4px solid ${COLORS.border}`, borderTopColor: COLORS.primary, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: COLORS.textMuted }}>Kontrol ediliyor...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user || !isLoggedIn || (userRole !== 'chief_observer' && userRole !== 'musahit' && !user?.observerId)) return null;

  const ballotBoxId = user.ballotBoxId || user.ballot_box_id;
  const ballotNumber = user.ballotNumber || user.ballot_number || '';
  const userId = user.uid || user.id || user.observerId;

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px' }}>

        {/* HEADER — kompakt yatay bar */}
        <header style={{
          background: `linear-gradient(135deg, ${COLORS.primaryDark} 0%, ${COLORS.primary} 100%)`,
          borderRadius: 8, padding: '14px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'white',
          boxShadow: '0 2px 8px rgba(220,38,38,.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Başmüşahit Dashboard</h1>
              <p style={{ fontSize: 12, opacity: 0.9, margin: '2px 0 0' }}>
                {user.name || 'Kullanıcı'}{ballotNumber && <> &middot; Sandık <strong>{ballotNumber}</strong></>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <NotificationBell
              className="notification-bell-header"
              iconClassName=""
            />
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 14px', background: 'rgba(255,255,255,.2)', color: 'white',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Çıkış
            </button>
          </div>
        </header>

        {/* MESAJ */}
        {message && (
          <div style={{
            padding: '12px 16px', marginBottom: 16, borderRadius: 8,
            background: messageType === 'success' ? '#d1fae5' : '#fee2e2',
            color: messageType === 'success' ? '#065f46' : '#7f1d1d',
            borderLeft: `4px solid ${messageType === 'success' ? '#10b981' : '#ef4444'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{message}</span>
            <button onClick={() => setMessage('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* STATS — 4 kompakt kart */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatCard label="Toplam Seçim" value={elections.length} color="#2563eb" />
          <StatCard label="Tamamlanan" value={completedCount} color="#10b981" />
          <StatCard label="Bekleyen" value={pendingCount} color="#f97316" />
          <StatCard label="Onay Bekleyen" value={pendingApprovals.length} color="#dc2626" onClick={() => setActiveTab('approvals')} />
        </div>

        {/* MAIN LAYOUT — flex 2/1 (sol içerik / sağ panel) */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* SOL */}
          <main style={{ flex: '2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Tabs */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}` }}>
                <button
                  onClick={() => setActiveTab('elections')}
                  style={{
                    padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 600,
                    color: activeTab === 'elections' ? COLORS.primary : COLORS.textMuted,
                    borderBottom: activeTab === 'elections' ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  Güncel Seçimler ({elections.length})
                </button>
                <button
                  onClick={() => setActiveTab('approvals')}
                  style={{
                    padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 600,
                    color: activeTab === 'approvals' ? COLORS.primary : COLORS.textMuted,
                    borderBottom: activeTab === 'approvals' ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                    marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  Bekleyen Onaylar
                  {pendingApprovals.length > 0 && (
                    <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      {pendingApprovals.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Elections Tab */}
              {activeTab === 'elections' && (
                <div style={{ padding: 16 }}>
                  {loading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: COLORS.textMuted }}>Yükleniyor...</div>
                  ) : error ? (
                    <div style={{ padding: 16, background: '#fee2e2', color: '#7f1d1d', borderRadius: 6 }}>{error}</div>
                  ) : elections.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: COLORS.textMuted }}>
                      <p style={{ fontSize: 16, fontWeight: 600 }}>Aktif seçim yok</p>
                      <p style={{ fontSize: 13, marginTop: 8 }}>Yeni seçim eklendiğinde burada görünecek.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {elections.map((election) => {
                        const days = getDaysUntil(election.date);
                        const status = getElectionStatus(election);
                        const isCompleted = hasResult(election.id);
                        return (
                          <div
                            key={election.id}
                            onClick={() => handleElectionClick(election)}
                            style={{
                              padding: 14, borderRadius: 8, cursor: 'pointer',
                              background: COLORS.primaryLight,
                              border: `1px solid ${isCompleted ? '#10b981' : COLORS.border}`,
                              transition: 'all .15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)')}
                            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: '0 0 4px' }}>{election.name || 'İsimsiz Seçim'}</h3>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
                                  <span style={{ background: 'rgba(220,38,38,.1)', color: COLORS.primary, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                                    {getTypeLabel(election.type)}
                                  </span>
                                  <span>{formatDate(election.date)}</span>
                                  {days !== null && days >= 0 && <span>· {days === 0 ? 'Bugün' : `${days} gün kaldı`}</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {status.type === 'multi' ? (
                                    <>
                                      <StatusBadge status={status.cb.status} prefix="CB" reason={status.cb.reason} />
                                      <StatusBadge status={status.mv.status} prefix="MV" reason={status.mv.reason} />
                                    </>
                                  ) : (
                                    <StatusBadge status={status.overall.status} reason={status.overall.reason} />
                                  )}
                                </div>
                              </div>
                              <div style={{ color: COLORS.primary, fontSize: 20 }}>›</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Approvals Tab */}
              {activeTab === 'approvals' && (
                <div style={{ padding: 16 }}>
                  {loadingApprovals ? (
                    <div style={{ padding: 32, textAlign: 'center', color: COLORS.textMuted }}>Yükleniyor...</div>
                  ) : pendingApprovals.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: COLORS.textMuted }}>
                      <p style={{ fontSize: 16, fontWeight: 600 }}>Bekleyen onay yok</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {pendingApprovals.map((r) => (
                        <div key={`${r.id}_${r.category || 'a'}`} style={{ border: '2px solid #fb923c', borderRadius: 8, padding: 14, background: '#fff7ed' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            {r.category === 'cb' && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>🗳️ CB</span>}
                            {r.category === 'mv' && <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>🏛️ MV</span>}
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{r.election_name || 'Seçim'}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.textMuted }}>Sandık {r.ballot_number}</span>
                          </div>
                          {(() => {
                            // Genel seçimde CB/MV ayrı tutanak; kategori bazlı oy alanları
                            // r.cb_used_votes / r.mv_used_votes. Fallback: paylaşılan alanlar.
                            const used = r.category === 'cb'
                              ? (r.cb_used_votes ?? r.used_votes ?? 0)
                              : r.category === 'mv'
                              ? (r.mv_used_votes ?? r.used_votes ?? 0)
                              : (r.used_votes ?? 0);
                            const valid = r.category === 'cb'
                              ? (r.cb_valid_votes ?? r.valid_votes ?? 0)
                              : r.category === 'mv'
                              ? (r.mv_valid_votes ?? r.valid_votes ?? 0)
                              : (r.valid_votes ?? 0);
                            const invalid = r.category === 'cb'
                              ? (r.cb_invalid_votes ?? r.invalid_votes ?? 0)
                              : r.category === 'mv'
                              ? (r.mv_invalid_votes ?? r.invalid_votes ?? 0)
                              : (r.invalid_votes ?? 0);
                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12, marginBottom: 12 }}>
                                <div><span style={{ color: COLORS.textMuted }}>Kullanılan:</span> <strong>{used || 0}</strong></div>
                                <div><span style={{ color: COLORS.textMuted }}>Geçerli:</span> <strong>{valid || 0}</strong></div>
                                <div><span style={{ color: COLORS.textMuted }}>Geçersiz:</span> <strong>{invalid || 0}</strong></div>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Genel seçimde MV kategorisi ise MV tutanak fotoğrafı, değilse signed
                            const photo = r.category === 'mv' && r.signed_mv_protocol_photo
                              ? r.signed_mv_protocol_photo
                              : r.signed_protocol_photo;

                            // Kategoriye göre hangi parti/aday listeleri gösterilecek
                            const voteGroups = [];
                            if (r.category === 'cb' || !r.category) {
                              if (r.cb_votes && Object.keys(r.cb_votes).length > 0)
                                voteGroups.push({ label: 'Cumhurbaşkanı', votes: r.cb_votes, color: '#1e40af', bg: '#dbeafe' });
                              if (r.independent_cb_votes && Object.keys(r.independent_cb_votes).length > 0)
                                voteGroups.push({ label: 'Bağımsız CB', votes: r.independent_cb_votes, color: '#3730a3', bg: '#e0e7ff' });
                            }
                            if (r.category === 'mv' || !r.category) {
                              if (r.mv_votes && Object.keys(r.mv_votes).length > 0)
                                voteGroups.push({ label: 'Milletvekili (Parti)', votes: r.mv_votes, color: '#5b21b6', bg: '#ede9fe' });
                              if (r.independent_mv_votes && Object.keys(r.independent_mv_votes).length > 0)
                                voteGroups.push({ label: 'Bağımsız MV', votes: r.independent_mv_votes, color: '#3730a3', bg: '#e0e7ff' });
                            }
                            if (!r.category) {
                              if (r.mayor_votes && Object.keys(r.mayor_votes).length > 0)
                                voteGroups.push({ label: 'Belediye Başkanı', votes: r.mayor_votes, color: '#065f46', bg: '#d1fae5' });
                              if (r.provincial_assembly_votes && Object.keys(r.provincial_assembly_votes).length > 0)
                                voteGroups.push({ label: 'İl Genel Meclisi', votes: r.provincial_assembly_votes, color: '#92400e', bg: '#fef3c7' });
                              if (r.municipal_council_votes && Object.keys(r.municipal_council_votes).length > 0)
                                voteGroups.push({ label: 'Belediye Meclisi', votes: r.municipal_council_votes, color: '#9a3412', bg: '#ffedd5' });
                              if (r.referendum_votes && Object.keys(r.referendum_votes).length > 0)
                                voteGroups.push({ label: 'Referandum', votes: r.referendum_votes, color: '#9f1239', bg: '#ffe4e6' });
                            }
                            const hasVotes = voteGroups.length > 0;

                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: hasVotes ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 10, marginBottom: 10 }}>
                                {photo && (
                                  <img src={photo} alt="Tutanak" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 6, border: `1px solid ${COLORS.border}`, cursor: 'pointer', background: '#fff' }} onClick={() => window.open(photo, '_blank')} />
                                )}
                                {hasVotes && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', padding: 4 }}>
                                    {voteGroups.map((g, gi) => {
                                      const entries = Object.entries(g.votes).filter(([, v]) => v !== null && v !== undefined);
                                      const total = entries.reduce((s, [, v]) => s + (parseInt(v) || 0), 0);
                                      return (
                                        <div key={gi} style={{ background: g.bg, borderRadius: 6, padding: 8, border: `1px solid ${g.color}33` }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <strong style={{ color: g.color, fontSize: 11 }}>{g.label}</strong>
                                            <span style={{ fontSize: 10, color: COLORS.textMuted }}>Toplam: <strong>{total}</strong></span>
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {entries.map(([key, v]) => (
                                              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '3px 6px', background: '#fff', borderRadius: 4 }}>
                                                <span style={{ color: '#374151', flex: 1, marginRight: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key}</span>
                                                <strong style={{ color: g.color, whiteSpace: 'nowrap' }}>{parseInt(v) || 0} oy</strong>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleApprove(r.id, r.category)} style={{ flex: 1, padding: '8px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Onayla</button>
                            <button onClick={() => { const reason = prompt('Reddetme nedeni (opsiyonel):') || ''; if (window.confirm('Sonuç silinecek. Devam?')) handleReject(r.id, reason, r.category); }} style={{ flex: 1, padding: '8px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Reddet</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Yüklenen Evraklar */}
            {ballotBoxId ? (
              <div id="yuklenen-evraklar">
                <BallotBoxDocumentsPanel
                  ballotBoxId={ballotBoxId}
                  ballotNumber={ballotNumber}
                  canUpload
                  canDelete
                  uploaderName={user.name || ''}
                  uploaderRole="chief_observer"
                />
              </div>
            ) : (
              <div style={{ padding: 16, background: '#fef3c7', borderLeft: '4px solid #f59e0b', borderRadius: 8 }}>
                <strong>Sandığa atanmadınız.</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>Üst sorumlunuzla iletişime geçin — sandık atanınca evrak yükleme alanı görünür.</p>
              </div>
            )}
          </main>

          {/* SAĞ PANEL */}
          <aside style={{
            flex: '1 1 0', minWidth: 0,
            display: 'flex', flexDirection: 'column', gap: 16,
            position: 'sticky', top: 16, alignSelf: 'flex-start',
          }}>

            {/* Hızlı İletişim */}
            {(institutionSupervisor || regionSupervisor) && (
              <Card title="Hızlı İletişim" icon={<span style={{ fontSize: 14 }}>📞</span>}>
                {institutionSupervisor && (
                  <a href={institutionSupervisor.phone ? `tel:${institutionSupervisor.phone}` : '#'} style={{ display: 'block', padding: 10, background: COLORS.primaryLight, borderRadius: 6, textDecoration: 'none', color: 'inherit', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kurum Sorumlusu</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{institutionSupervisor.name}</div>
                    {institutionSupervisor.phone && <div style={{ fontSize: 12, color: COLORS.textMuted }}>📞 {institutionSupervisor.phone}</div>}
                  </a>
                )}
                {regionSupervisor && (
                  <a href={regionSupervisor.phone ? `tel:${regionSupervisor.phone}` : '#'} style={{ display: 'block', padding: 10, background: '#fffbeb', borderRadius: 6, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bölge Sorumlusu</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{regionSupervisor.name}</div>
                    {regionSupervisor.phone && <div style={{ fontSize: 12, color: COLORS.textMuted }}>📞 {regionSupervisor.phone}</div>}
                  </a>
                )}
              </Card>
            )}

            {/* Hızlı Aksiyonlar */}
            <Card title="Hızlı Aksiyonlar" icon={<span style={{ fontSize: 14 }}>⚡</span>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => { const e = elections[0]; if (e) handleElectionClick(e); }}
                  disabled={elections.length === 0}
                  style={{ padding: '10px 12px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: elections.length === 0 ? 'not-allowed' : 'pointer', opacity: elections.length === 0 ? 0.5 : 1, textAlign: 'left' }}
                >
                  📝 Sonuç Gir / Düzenle
                </button>
                <button
                  onClick={() => setActiveTab('approvals')}
                  style={{ padding: '10px 12px', background: '#fef3c7', color: '#78350f', border: '1px solid #fcd34d', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>⏳ Onay Bekleyenler</span>
                  {pendingApprovals.length > 0 && <span style={{ background: '#d97706', color: 'white', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>{pendingApprovals.length}</span>}
                </button>
                <a href="#yuklenen-evraklar" style={{ padding: '10px 12px', background: '#f3f4f6', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontWeight: 600, fontSize: 13, textAlign: 'left', textDecoration: 'none', display: 'block' }}>
                  📤 Evrak Yükle
                </a>
              </div>
            </Card>

            {/* Bildirim Feed */}
            <NotificationFeed userId={userId} />

            {/* Eğitim */}
            <TrainingMaterialList audience="chief_observer" title="Eğitim Materyalleri" />
          </aside>

        </div>
      </div>

      {/* Result Form Modal */}
      {showResultForm && selectedElection && user && ballotBoxId && (
        useAdvancedForm ? (
          <ElectionResultForm
            election={selectedElection}
            ballotBoxId={ballotBoxId}
            ballotNumber={ballotNumber}
            onClose={handleCloseForm}
            onSuccess={handleFormSuccess}
          />
        ) : (
          <ChiefObserverQuickForm
            election={selectedElection}
            ballotBoxId={ballotBoxId}
            ballotNumber={ballotNumber}
            onClose={handleCloseForm}
            onSuccess={handleFormSuccess}
            onSwitchToAdvanced={() => setUseAdvancedForm(true)}
          />
        )
      )}

      <OfflineIndicator />
    </div>
  );
};

export default ChiefObserverDashboardPage;
