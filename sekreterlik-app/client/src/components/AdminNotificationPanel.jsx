import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ApiService from '../utils/ApiService';
import NotificationService, {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  TARGET_TYPES,
} from '../services/NotificationService';

const AdminNotificationPanel = () => {
  const { user } = useAuth();
  const toast = useToast();

  // Form state (Madde 6)
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState(NOTIFICATION_TYPES.ANNOUNCEMENT);
  const [targetType, setTargetType] = useState(TARGET_TYPES.ALL);
  const [targetValue, setTargetValue] = useState('');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);

  // Hedef secimi verileri (Madde 7)
  const [regions, setRegions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  // Onizleme (Madde 8)
  const [targetCount, setTargetCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);

  // Gonderim gecmisi (Madde 9)
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('compose'); // compose | history | scheduled

  // Zamanli gonderim (Madde 10)
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduledNotifications, setScheduledNotifications] = useState([]);

  // Veri yukle
  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [regionsData, positionsData, membersData] = await Promise.all([
          ApiService.getRegions(),
          ApiService.getPositions(),
          ApiService.getMembers(),
        ]);
        setRegions(Array.isArray(regionsData) ? regionsData : []);
        setPositions(Array.isArray(positionsData) ? positionsData : []);
        setMembers(Array.isArray(membersData) ? membersData : []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, []);

  // Hedef sayisi hesapla (Madde 8)
  useEffect(() => {
    const calculateCount = async () => {
      setCountLoading(true);
      try {
        const target = buildTarget();
        const count = await NotificationService.getTargetCount(target);
        setTargetCount(count);
      } catch {
        setTargetCount(0);
      } finally {
        setCountLoading(false);
      }
    };

    const debounce = setTimeout(calculateCount, 300);
    return () => clearTimeout(debounce);
  }, [targetType, targetValue, members.length]);

  // Gecmis yukle
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await NotificationService.getNotificationHistory(50);
      setHistory(data);
    } catch (error) {
      console.error('History load error:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadScheduled = useCallback(async () => {
    try {
      const data = await NotificationService.getScheduledNotifications();
      setScheduledNotifications(data);
    } catch (error) {
      console.error('Scheduled load error:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'scheduled') loadScheduled();
  }, [activeTab, loadHistory, loadScheduled]);

  const buildTarget = () => {
    if (targetType === TARGET_TYPES.ALL) return { type: TARGET_TYPES.ALL };
    if (targetType === TARGET_TYPES.REGION) return { type: TARGET_TYPES.REGION, value: targetValue };
    if (targetType === TARGET_TYPES.ROLE) return { type: TARGET_TYPES.ROLE, value: targetValue };
    if (targetType === TARGET_TYPES.SINGLE) return { type: TARGET_TYPES.SINGLE, value: targetValue };
    return { type: TARGET_TYPES.ALL };
  };

  // Gonder (Madde 6)
  const handleSend = async () => {
    if (!title.trim()) {
      toast?.error?.('Baslik zorunludur');
      return;
    }
    if (!body.trim()) {
      toast?.error?.('Mesaj zorunludur');
      return;
    }
    if (targetType !== TARGET_TYPES.ALL && !targetValue) {
      toast?.error?.('Hedef secimi yapiniz');
      return;
    }

    setSending(true);
    try {
      let scheduledAt = null;
      if (isScheduled && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const result = await NotificationService.createNotification({
        title: title.trim(),
        body: body.trim(),
        type,
        target: buildTarget(),
        url: url.trim() || null,
        scheduledAt,
      });

      if (result.success) {
        const statusMsg = result.status === 'scheduled'
          ? 'Bildirim zamanlanarak kaydedildi'
          : `Bildirim ${result.targetCount} kisiye gonderildi`;
        toast?.success?.(statusMsg);
        // Formu sifirla
        setTitle('');
        setBody('');
        setType(NOTIFICATION_TYPES.ANNOUNCEMENT);
        setTargetType(TARGET_TYPES.ALL);
        setTargetValue('');
        setUrl('');
        setIsScheduled(false);
        setScheduledDate('');
        setScheduledTime('');
      } else {
        toast?.error?.('Bildirim gonderilemedi: ' + (result.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Send error:', error);
      toast?.error?.('Bildirim gonderilemedi');
    } finally {
      setSending(false);
    }
  };

  // Zamanli bildirimi iptal et
  const handleCancelScheduled = async (id) => {
    try {
      await NotificationService.cancelScheduledNotification(id);
      toast?.success?.('Zamanli bildirim iptal edildi');
      loadScheduled();
    } catch {
      toast?.error?.('Iptal islemi basarisiz');
    }
  };

  // Uye arama filtreleme (Madde 7)
  const filteredMembers = members.filter(m => {
    if (!memberSearch.trim()) return true;
    const search = memberSearch.toLowerCase();
    const name = `${m.name || ''} ${m.surname || ''}`.toLowerCase();
    const phone = (m.phone || '').toLowerCase();
    return name.includes(search) || phone.includes(search);
  }).slice(0, 20);

  // Tarih formatlama
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getTargetLabel = (target) => {
    if (!target) return 'Tum uyeler';
    switch (target.type) {
      case TARGET_TYPES.ALL: return 'Tum uyeler';
      case TARGET_TYPES.REGION: return `Bolge: ${target.value}`;
      case TARGET_TYPES.ROLE: return `Gorev: ${target.value}`;
      case TARGET_TYPES.SINGLE: return `Tek kisi`;
      default: return '-';
    }
  };

  const getTypeLabel = (typeVal) => {
    return NOTIFICATION_TYPE_LABELS[typeVal] || typeVal || '-';
  };

  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bildirim Yonetimi</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Uyelere bildirim gonderin ve gecmis bildirimleri yonetin
          </p>
        </div>
      </div>

      {/* Tab Navigasyonu */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'compose', label: 'Yeni Bildirim', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )},
          { id: 'history', label: 'Gonderim Gecmisi', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )},
          { id: 'scheduled', label: 'Zamanlanmis', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )},
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== Yeni Bildirim Tab (Madde 6, 7, 8, 10) ==================== */}
      {activeTab === 'compose' && (
        <div className="space-y-5">
          {/* Baslik (Madde 6) */}
          <div>
            <label htmlFor="notification-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Baslik <span className="text-red-500">*</span>
            </label>
            <input
              id="notification-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bildirim basligi"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              maxLength={200}
            />
          </div>

          {/* Mesaj (Madde 6) */}
          <div>
            <label htmlFor="notification-body" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mesaj <span className="text-red-500">*</span>
            </label>
            <textarea
              id="notification-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bildirim mesaji"
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 mt-1">{body.length}/1000</p>
          </div>

          {/* Tip (Madde 6) */}
          <div>
            <label htmlFor="notification-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bildirim Tipi
            </label>
            <select
              id="notification-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Hedef Secimi (Madde 6, 7) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Hedef
            </label>
            <div className="flex flex-wrap gap-3 mb-3">
              {[
                { value: TARGET_TYPES.ALL, label: 'Tum Uyeler' },
                { value: TARGET_TYPES.REGION, label: 'Bolge' },
                { value: TARGET_TYPES.ROLE, label: 'Gorev' },
                { value: TARGET_TYPES.SINGLE, label: 'Tek Kisi' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value={opt.value}
                    checked={targetType === opt.value}
                    onChange={() => { setTargetType(opt.value); setTargetValue(''); setMemberSearch(''); }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                </label>
              ))}
            </div>

            {/* Bolge dropdown (Madde 7) */}
            {targetType === TARGET_TYPES.REGION && (
              <select
                aria-label="Bolge secimi"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Bolge secin...</option>
                {regions.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            )}

            {/* Gorev dropdown (Madde 7) */}
            {targetType === TARGET_TYPES.ROLE && (
              <select
                aria-label="Gorev secimi"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Gorev secin...</option>
                {positions.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            )}

            {/* Uye arama (Madde 7) */}
            {targetType === TARGET_TYPES.SINGLE && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  aria-label="Uye arama"
                  placeholder="Uye adi veya telefon ile arama..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {memberSearch.trim() && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredMembers.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500 dark:text-gray-400">Sonuc bulunamadi</p>
                    ) : (
                      filteredMembers.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setTargetValue(String(m.id)); setMemberSearch(`${m.name || ''} ${m.surname || ''}`.trim()); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${
                            targetValue === String(m.id) ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className="font-medium">{m.name} {m.surname}</span>
                          {m.phone && <span className="ml-2 text-gray-400">({m.phone})</span>}
                          {m.region && <span className="ml-2 text-xs text-gray-400">- {m.region}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* URL (opsiyonel) */}
          <div>
            <label htmlFor="notification-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Baglanti URL (opsiyonel)
            </label>
            <input
              id="notification-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/meetings veya /events gibi"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Zamanli Gonderim (Madde 10) */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Zamanli gonder
              </span>
            </label>
            {isScheduled && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label htmlFor="notification-scheduled-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tarih</label>
                  <input
                    id="notification-scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="notification-scheduled-time" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Saat</label>
                  <input
                    id="notification-scheduled-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Onizleme Badge (Madde 8) */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {countLoading ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="animate-spin h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full"></span>
                    Hesaplaniyor...
                  </span>
                ) : (
                  <span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{targetCount}</span> kisiye gonderilecek
                  </span>
                )}
              </span>
            </div>
            {isScheduled && scheduledDate && scheduledTime && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDate(`${scheduledDate}T${scheduledTime}`)}
              </span>
            )}
          </div>

          {/* Gonder Butonu */}
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                Gonderiliyor...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {isScheduled ? 'Zamanla' : 'Gonder'}
              </>
            )}
          </button>
        </div>
      )}

      {/* ==================== Gonderim Gecmisi Tab (Madde 9) ==================== */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">Henuz bildirim gonderilmemis</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map((item) => (
                <div key={item.id} className="py-3 flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                    ${item.status === 'sent' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                      item.status === 'scheduled' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
                  >
                    {item.status === 'sent' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : item.status === 'scheduled' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.title}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {getTypeLabel(item.type)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{item.body}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>{getTargetLabel(item.target)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== Zamanlanmis Tab (Madde 10) ==================== */}
      {activeTab === 'scheduled' && (
        <div className="space-y-3">
          {scheduledNotifications.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">Zamanlanmis bildirim bulunmuyor</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {scheduledNotifications.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.body}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDate(item.scheduledAt)}
                      </span>
                      <span>{getTargetLabel(item.target)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelScheduled(item.id)}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    Iptal Et
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminNotificationPanel;
