import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import ElectionResultForm from '../components/ElectionResultForm';
import OfflineIndicator from '../components/OfflineIndicator';

const ElectionResultEditPage = () => {
  const { electionId, resultId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [result, setResult] = useState(null);
  const [ballotBox, setBallotBox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(false);

  useEffect(() => {
    fetchData();
  }, [electionId, resultId]);

  useEffect(() => {
    if (!result?.id) return;
    let cancelled = false;
    setAuditLoading(true);
    setAuditError(false);
    ApiService.getElectionResultAuditLogs(result.id)
      .then((logs) => {
        if (cancelled) return;
        const arr = Array.isArray(logs) ? logs : (logs?.logs || []);
        setAuditLogs(arr);
      })
      .catch(() => {
        if (cancelled) return;
        setAuditLogs([]);
        setAuditError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setAuditLoading(false);
      });
    return () => { cancelled = true; };
  }, [result?.id]);

  // Audit log helpers
  const formatRole = (role, userId) => {
    if (!role) return '';
    if (role === 'musahit') return 'Müşahit';
    if (role === 'member') return userId ? 'Başmüşahit' : 'Üye';
    if (role === 'institution_supervisor') return 'Kurum Sorumlusu';
    if (role === 'region_supervisor') return 'Bölge Sorumlusu';
    if (role === 'district_supervisor') return 'İlçe Sorumlusu';
    if (role === 'provincial_coordinator') return 'İl Genel Sorumlusu';
    if (role === 'admin') return 'Admin';
    return role;
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'create_cb': return 'CB sonucu girildi';
      case 'create_mv': return 'MV sonucu girildi';
      case 'update_cb': return 'CB sonucu düzeltildi';
      case 'update_mv': return 'MV sonucu düzeltildi';
      case 'approve_cb': return 'CB sonucu onaylandı';
      case 'approve_mv': return 'MV sonucu onaylandı';
      case 'reject_cb': return 'CB sonucu silindi (yeniden girilmesi gerek)';
      case 'reject_mv': return 'MV sonucu silindi';
      case 'create': return 'Sonuç girildi';
      case 'update': return 'Sonuç düzeltildi';
      case 'approve': return 'Sonuç onaylandı';
      case 'reject': return 'Sonuç reddedildi/silindi';
      default: return action || 'İşlem';
    }
  };

  const getActionStyle = (action, category) => {
    // Renk paleti: oluşturma yeşil, güncelleme mavi/CB-mavi/MV-mor,
    // onay yeşil-check, ret kırmızı.
    if (!action) return { icon: '•', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', ring: 'ring-gray-300' };
    if (action.startsWith('reject')) {
      return { icon: '✕', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-600 dark:text-red-300', ring: 'ring-red-300' };
    }
    if (action.startsWith('approve')) {
      return { icon: '✓', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-300' };
    }
    if (action.startsWith('create')) {
      // CB → mavi, MV → mor, kategorisiz → yeşil
      if (category === 'cb' || action === 'create_cb') {
        return { icon: '＋', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-300' };
      }
      if (category === 'mv' || action === 'create_mv') {
        return { icon: '＋', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', ring: 'ring-purple-300' };
      }
      return { icon: '＋', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-300' };
    }
    if (action.startsWith('update')) {
      if (category === 'cb' || action === 'update_cb') {
        return { icon: '✎', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-300' };
      }
      if (category === 'mv' || action === 'update_mv') {
        return { icon: '✎', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', ring: 'ring-purple-300' };
      }
      return { icon: '✎', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-300' };
    }
    return { icon: '•', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', ring: 'ring-gray-300' };
  };

  const formatDateTime = (val) => {
    if (!val) return '';
    try {
      // Firestore Timestamp benzeri obje desteği
      const d = val?.toDate ? val.toDate()
        : val?._seconds ? new Date(val._seconds * 1000)
        : val?.seconds ? new Date(val.seconds * 1000)
        : new Date(val);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('tr-TR');
    } catch { return ''; }
  };

  const sortedAuditLogs = useMemo(() => {
    const toMs = (v) => {
      if (!v) return 0;
      if (v?.toDate) return v.toDate().getTime();
      if (v?._seconds) return v._seconds * 1000;
      if (v?.seconds) return v.seconds * 1000;
      const t = new Date(v).getTime();
      return isNaN(t) ? 0 : t;
    };
    return [...(auditLogs || [])].sort((a, b) => toMs(b?.created_at) - toMs(a?.created_at));
  }, [auditLogs]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [electionsData, resultsData, ballotBoxesData] = await Promise.all([
        ApiService.getElections(),
        ApiService.getElectionResults(electionId, null),
        ApiService.getBallotBoxes()
      ]);

      const selectedElection = electionsData.find(e => String(e.id) === String(electionId));
      const selectedResult = resultsData.find(r => String(r.id) === String(resultId));
      const selectedBallotBox = ballotBoxesData.find(bb => String(bb.id) === String(selectedResult?.ballot_box_id));

      setElection(selectedElection);
      setResult(selectedResult);
      setBallotBox(selectedBallotBox);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    fetchData();
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!election || !result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Seçim sonucu bulunamadı</h2>
          <button
            onClick={() => navigate(`/election-results/${electionId}`)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  const protocolPhoto = result.signed_protocol_photo || result.signedProtocolPhoto;
  const mvProtocolPhoto = result.signed_mv_protocol_photo || result.signedMvProtocolPhoto;
  const objectionPhoto = result.objection_protocol_photo || result.objectionProtocolPhoto;
  // Genel seçim: CB ve MV ayrı tutanaklar
  const isGenel = result.election_type === 'genel' || result.electionType === 'genel';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Seçim Sonucu Düzenle - Sandık {result.ballot_number}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{election.name}</p>
            </div>
            <button
              onClick={() => navigate(`/election-results/${electionId}`)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              ← Geri Dön
            </button>
          </div>
        </div>

        {/* Main Content: Protocol on Left, Form on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Protocol Photos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Seçim Tutanakları</h2>
            
            {protocolPhoto && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {isGenel ? 'Cumhurbaşkanı (CB) Tutanağı' : 'İmzalı Tutanak'}
                </h3>
                <div className="border-2 border-blue-200 dark:border-blue-700 rounded-lg overflow-hidden">
                  <img
                    src={protocolPhoto}
                    alt="CB Tutanağı"
                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(protocolPhoto, '_blank')}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              </div>
            )}

            {mvProtocolPhoto && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Milletvekili (MV) Tutanağı
                </h3>
                <div className="border-2 border-purple-200 dark:border-purple-700 rounded-lg overflow-hidden">
                  <img
                    src={mvProtocolPhoto}
                    alt="MV Tutanağı"
                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(mvProtocolPhoto, '_blank')}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              </div>
            )}

            {objectionPhoto && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">İtiraz Tutanağı</h3>
                <div className="border-2 border-red-200 rounded-lg overflow-hidden">
                  <img
                    src={objectionPhoto}
                    alt="İtiraz Tutanağı"
                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(objectionPhoto, '_blank')}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              </div>
            )}

            {!protocolPhoto && !mvProtocolPhoto && !objectionPhoto && (
              <div className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
                <p className="text-gray-500 dark:text-gray-400">Henüz tutanak fotoğrafı yüklenmemiş</p>
              </div>
            )}
          </div>

          {/* Right: Form or Edit Button */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            {!showForm ? (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Seçim Sonuç Verileri</h2>

                {/* Onay durumu — Capabilities Model:
                    Genel seçimde cb_status ve mv_status ayrı; onaylanmamış olan
                    kategoriler badge ile gösterilir. Reject = silme olduğu için
                    'rejected' statüsü artık üretilmiyor; eski format için badge'i
                    sadece açık 'pending' durumu için göster. */}
                {(() => {
                  const cbPending = result.cb_status === 'pending';
                  const mvPending = result.mv_status === 'pending';
                  const generalPending = !result.cb_status && !result.mv_status && result.approval_status === 'pending';
                  if (!cbPending && !mvPending && !generalPending) return null;
                  return (
                    <div className="mb-4 p-3 rounded-lg text-sm font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                      ⏳ Onay bekleniyor:
                      {cbPending && <span className="ml-1 font-semibold">CB</span>}
                      {cbPending && mvPending && <span> ve </span>}
                      {mvPending && <span className="ml-1 font-semibold">MV</span>}
                      {generalPending && <span> sonuç</span>}
                    </div>
                  );
                })()}

                {/* Veri varlık kontrolü — Capabilities Model:
                    Genel seçimde cb ve mv alanları, parti oyları ya da paylaşılan
                    sayılar — herhangi biri doluysa veri vardır. Sadece paylaşılan
                    used/valid/invalid alanlarına bakmak yanıltıcıydı (kategori save'de bu
                    alanlar boş kalabiliyor). */}
                {(() => {
                  const cbVotesHas = result.cb_votes && Object.keys(result.cb_votes).length > 0;
                  const mvVotesHas = result.mv_votes && Object.keys(result.mv_votes).length > 0;
                  const sharedHas = !!(result.used_votes || result.valid_votes || result.invalid_votes);
                  const cbCatHas = !!(result.cb_used_votes || result.cb_valid_votes || result.cb_invalid_votes);
                  const mvCatHas = !!(result.mv_used_votes || result.mv_valid_votes || result.mv_invalid_votes);
                  const otherVotesHas =
                    (result.mayor_votes && Object.keys(result.mayor_votes).length > 0) ||
                    (result.provincial_assembly_votes && Object.keys(result.provincial_assembly_votes).length > 0) ||
                    (result.municipal_council_votes && Object.keys(result.municipal_council_votes).length > 0);
                  const hasAnyData = sharedHas || cbCatHas || mvCatHas || cbVotesHas || mvVotesHas || otherVotesHas;

                  if (!hasAnyData) {
                    return (
                      <div className="p-8 border-2 border-dashed border-amber-300 rounded-lg text-center bg-amber-50 mb-6">
                        <p className="text-amber-800 font-medium">⚠️ Seçim sonuç verileri girilmemiş</p>
                        <p className="text-sm text-amber-600 mt-2">Sadece tutanak fotoğrafı yüklenmiş</p>
                      </div>
                    );
                  }

                  // Genel seçim → her zaman CB/MV ayrı blok göster (parti oyları varsa
                  // veya kategori-bazlı sayılar varsa). Eski format kayıtlarda paylaşılan
                  // alanlar veya parti oy toplamlarından fallback yapılır.
                  const isGenelDetail = (result.election_type === 'genel' || result.electionType === 'genel') &&
                    (cbCatHas || mvCatHas || cbVotesHas || mvVotesHas);

                  // Parti oy toplamı (geçerli oy fallback'i için)
                  const sumOf = (obj) =>
                    obj && typeof obj === 'object'
                      ? Object.values(obj).reduce((s, v) => s + (parseInt(v) || 0), 0)
                      : 0;
                  const cbVotesTotal = sumOf(result.cb_votes);
                  const mvVotesTotal = sumOf(result.mv_votes);

                  // CB tarafı için fallback zinciri
                  const cbUsed = parseInt(result.cb_used_votes) || parseInt(result.used_votes) || 0;
                  const cbInvalid = parseInt(result.cb_invalid_votes) || parseInt(result.invalid_votes) || 0;
                  const cbValid = parseInt(result.cb_valid_votes) || parseInt(result.valid_votes) || cbVotesTotal || 0;

                  // MV tarafı için fallback zinciri
                  const mvUsed = parseInt(result.mv_used_votes) || parseInt(result.used_votes) || 0;
                  const mvInvalid = parseInt(result.mv_invalid_votes) || parseInt(result.invalid_votes) || 0;
                  const mvValid = parseInt(result.mv_valid_votes) || parseInt(result.valid_votes) || mvVotesTotal || 0;

                  return (
                    <div className="space-y-4 mb-6">
                      {isGenelDetail ? (
                        <>
                          {(cbCatHas || cbVotesHas) && (
                            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/30 dark:bg-blue-900/10">
                              <div className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">🗳️ Cumhurbaşkanı (CB)</div>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Kullanılan</label>
                                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{cbUsed}</div>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Geçersiz</label>
                                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{cbInvalid}</div>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Geçerli</label>
                                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{cbValid}</div>
                                </div>
                              </div>
                              {(result.cb_last_edited_by_name || result.cb_last_edited_at) && (
                                <div className="mt-2 text-[11px] text-blue-700/80 dark:text-blue-300/80">
                                  CB | Son düzelten: {result.cb_last_edited_by_name || '—'}
                                  {result.cb_last_edited_by_role ? ` (${formatRole(result.cb_last_edited_by_role)})` : ''}
                                  {result.cb_last_edited_at ? ` — ${formatDateTime(result.cb_last_edited_at)}` : ''}
                                </div>
                              )}
                            </div>
                          )}
                          {(mvCatHas || mvVotesHas) && (
                            <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50/30 dark:bg-purple-900/10">
                              <div className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">🏛️ Milletvekili (MV)</div>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Kullanılan</label>
                                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{mvUsed}</div>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Geçersiz</label>
                                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{mvInvalid}</div>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Geçerli</label>
                                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{mvValid}</div>
                                </div>
                              </div>
                              {(result.mv_last_edited_by_name || result.mv_last_edited_at) && (
                                <div className="mt-2 text-[11px] text-purple-700/80 dark:text-purple-300/80">
                                  MV | Son düzelten: {result.mv_last_edited_by_name || '—'}
                                  {result.mv_last_edited_by_role ? ` (${formatRole(result.mv_last_edited_by_role)})` : ''}
                                  {result.mv_last_edited_at ? ` — ${formatDateTime(result.mv_last_edited_at)}` : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Kullanılan Oy</label>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.used_votes || cbVotesTotal || mvVotesTotal || 0}</div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Geçersiz Oy</label>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.invalid_votes || 0}</div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Geçerli Oy</label>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.valid_votes || cbVotesTotal || mvVotesTotal || 0}</div>
                          </div>
                        </div>
                      )}

                      {/* Parti/Aday bazlı oy detayları — tutanak ile karşılaştırma için */}
                      {(() => {
                        const COLOR_MAP = {
                          blue: { wrap: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10', label: 'text-blue-700 dark:text-blue-300', value: 'text-blue-600 dark:text-blue-400' },
                          indigo: { wrap: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10', label: 'text-indigo-700 dark:text-indigo-300', value: 'text-indigo-600 dark:text-indigo-400' },
                          purple: { wrap: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10', label: 'text-purple-700 dark:text-purple-300', value: 'text-purple-600 dark:text-purple-400' },
                          green: { wrap: 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10', label: 'text-green-700 dark:text-green-300', value: 'text-green-600 dark:text-green-400' },
                          amber: { wrap: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10', label: 'text-amber-700 dark:text-amber-300', value: 'text-amber-600 dark:text-amber-400' },
                          orange: { wrap: 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10', label: 'text-orange-700 dark:text-orange-300', value: 'text-orange-600 dark:text-orange-400' },
                          rose: { wrap: 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10', label: 'text-rose-700 dark:text-rose-300', value: 'text-rose-600 dark:text-rose-400' }
                        };
                        const VoteList = ({ label, votes, color = 'blue' }) => {
                          if (!votes || typeof votes !== 'object') return null;
                          const entries = Object.entries(votes).filter(([, v]) => v !== null && v !== undefined);
                          if (entries.length === 0) return null;
                          const total = entries.reduce((s, [, v]) => s + (parseInt(v) || 0), 0);
                          const c = COLOR_MAP[color] || COLOR_MAP.blue;
                          return (
                            <div className={`border ${c.wrap} rounded-lg p-3`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className={`text-xs font-bold ${c.label}`}>{label}</div>
                                <div className="text-[11px] text-gray-500">Toplam: <strong>{total}</strong></div>
                              </div>
                              <div className="space-y-1 max-h-56 overflow-y-auto">
                                {entries.map(([key, v]) => (
                                  <div key={key} className="flex justify-between items-center text-xs py-1.5 px-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                    <span className="text-gray-700 dark:text-gray-300 font-medium truncate pr-2">{key}</span>
                                    <span className={`${c.value} font-bold whitespace-nowrap`}>{parseInt(v) || 0} oy</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        };
                        return (
                          <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Parti / Aday Bazında Girilen Oylar
                            </div>
                            <VoteList label="Cumhurbaşkanı" votes={result.cb_votes} color="blue" />
                            <VoteList label="Bağımsız CB Adayları" votes={result.independent_cb_votes} color="indigo" />
                            <VoteList label="Milletvekili (Parti)" votes={result.mv_votes} color="purple" />
                            <VoteList label="Bağımsız MV Adayları" votes={result.independent_mv_votes} color="indigo" />
                            <VoteList label="Belediye Başkanı" votes={result.mayor_votes} color="green" />
                            <VoteList label="Bağımsız Belediye Başkanı" votes={result.independent_mayor_votes} color="indigo" />
                            <VoteList label="İl Genel Meclisi" votes={result.provincial_assembly_votes} color="amber" />
                            <VoteList label="Belediye Meclisi" votes={result.municipal_council_votes} color="orange" />
                            <VoteList label="Referandum" votes={result.referendum_votes} color="rose" />

                            {/* Çapraz kontrol uyarısı */}
                            {(() => {
                              const sumOf = (obj) =>
                                obj && typeof obj === 'object'
                                  ? Object.values(obj).reduce((s, v) => s + (parseInt(v) || 0), 0)
                                  : 0;
                              const cbSum = sumOf(result.cb_votes) + sumOf(result.independent_cb_votes);
                              const mvSum = sumOf(result.mv_votes) + sumOf(result.independent_mv_votes);
                              const cbValidShown = parseInt(result.cb_valid_votes) || parseInt(result.valid_votes) || 0;
                              const mvValidShown = parseInt(result.mv_valid_votes) || parseInt(result.valid_votes) || 0;
                              const issues = [];
                              if (cbSum > 0 && cbValidShown > 0 && cbSum !== cbValidShown) {
                                issues.push(`CB toplam (${cbSum}) ≠ Geçerli oy (${cbValidShown})`);
                              }
                              if (mvSum > 0 && mvValidShown > 0 && mvSum !== mvValidShown) {
                                issues.push(`MV toplam (${mvSum}) ≠ Geçerli oy (${mvValidShown})`);
                              }
                              if (issues.length === 0) return null;
                              return (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                                  ⚠️ Tutarsızlık: {issues.join(' · ')}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {result.has_objection && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="text-sm font-semibold text-red-700 mb-1">İtiraz Edildi</div>
                          {result.objection_reason && (
                            <div className="text-sm text-red-600">{result.objection_reason}</div>
                          )}
                        </div>
                      )}

                      {result.notes && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Notlar</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{result.notes}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  {(result.used_votes || result.valid_votes || result.invalid_votes ||
                    result.cb_used_votes || result.cb_valid_votes ||
                    result.mv_used_votes || result.mv_valid_votes ||
                    (result.cb_votes && Object.keys(result.cb_votes).length > 0) ||
                    (result.mv_votes && Object.keys(result.mv_votes).length > 0))
                    ? 'Sonuçları Düzenle' : 'Sonuçları Gir'}
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setShowForm(false)}
                  className="mb-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  ← Formu Kapat
                </button>
                <ElectionResultForm
                  election={election}
                  ballotBoxId={result.ballot_box_id}
                  ballotNumber={result.ballot_number}
                  onClose={() => setShowForm(false)}
                  onSuccess={handleSuccess}
                />
              </div>
            )}
          </div>
        </div>

        {/* İşlem Geçmişi (audit log timeline) */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">📜 İşlem Geçmişi</h2>
            {!auditLoading && sortedAuditLogs.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{sortedAuditLogs.length} kayıt</span>
            )}
          </div>

          {/* Created by özet (varsa) */}
          {(result.created_by_name || result.created_by_at) && (
            <div className="mb-4 text-xs text-gray-600 dark:text-gray-400">
              Sandığa ilk veri girişi: <span className="font-medium">{result.created_by_name || '—'}</span>
              {result.created_by_role ? ` (${formatRole(result.created_by_role)})` : ''}
              {result.created_by_at ? ` — ${formatDateTime(result.created_by_at)}` : ''}
            </div>
          )}

          {auditLoading && (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
              <span>İşlem geçmişi yükleniyor...</span>
            </div>
          )}

          {!auditLoading && auditError && (
            <div className="p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              İşlem geçmişi yüklenemedi.
            </div>
          )}

          {!auditLoading && !auditError && sortedAuditLogs.length === 0 && (
            <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center text-sm text-gray-500 dark:text-gray-400">
              Henüz işlem yok
            </div>
          )}

          {!auditLoading && !auditError && sortedAuditLogs.length > 0 && (
            <ol className="relative border-s border-gray-200 dark:border-gray-700 ms-3">
              {sortedAuditLogs.map((log, idx) => {
                const style = getActionStyle(log.action, log.category);
                const label = getActionLabel(log.action);
                const userName = log.user_name || 'Bilinmeyen';
                const roleLabel = formatRole(log.user_role, log.user_id);
                const dateText = formatDateTime(log.created_at);
                const isReject = (log.action || '').startsWith('reject');
                return (
                  <li key={log.id || idx} className="ms-6 mb-5 last:mb-0">
                    <span
                      className={`absolute -start-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white dark:ring-gray-800 ${style.bg} ${style.text} text-xs font-bold`}
                      aria-hidden="true"
                    >
                      {style.icon}
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {dateText}
                      </div>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                      {userName}{roleLabel ? ` — ${roleLabel}` : ''}
                    </div>
                    {isReject && log.rejection_reason && (
                      <div className="mt-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                        Sebep: {log.rejection_reason}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
      <OfflineIndicator />
    </div>
  );
};

export default ElectionResultEditPage;

