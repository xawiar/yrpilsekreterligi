import React, { useState, useEffect, useRef, useCallback } from 'react';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';

const TYPE_BADGE = {
  video: { label: 'Video', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  pdf: { label: 'PDF', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  text: { label: 'Metin', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: 'M4 6h16M4 12h16M4 18h7' }
};

const youtubeEmbedUrl = (url) => {
  if (!url) return '';
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1` : url;
};

const useUserId = () => {
  const { user } = useAuth();
  return user?.uid || user?.id || user?.coordinatorId || user?.observerId || null;
};

/**
 * Tek bir eğitim materyali kartı + viewer modal + izleme takibi.
 * - Modal açılınca markTrainingOpened
 * - HTML5 video → onTimeUpdate ile her 5 sn updateTrainingProgress (auto %80'de tamamla)
 * - YouTube → IFrame Player API ile aynı (postMessage)
 * - PDF/metin → "Okudum" butonu (manual completed)
 */
const TrainingMaterialCard = ({ material }) => {
  const { user } = useAuth();
  const userId = useUserId();

  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(null); // {progress_percent, completed_at, ...}
  const [marking, setMarking] = useState(false);
  const videoRef = useRef(null);
  const lastSentRef = useRef(0); // throttling için son gönderim zamanı (ms)
  const ytPlayerRef = useRef(null);
  const ytIntervalRef = useRef(null);

  const type = material?.content_type || 'text';
  const badge = TYPE_BADGE[type] || TYPE_BADGE.text;

  // Modal açılınca markOpened + ilerleme çek
  useEffect(() => {
    if (!open || !userId || !material?.id) return;
    let mounted = true;
    (async () => {
      const userInfo = {
        name: user?.name || user?.firstName || '',
        role: user?.role || '',
        phone: user?.phone || '',
        ballot_box_id: user?.ballotBoxId || user?.ballot_box_id || null,
        ballot_number: user?.ballotNumber || user?.ballot_number || ''
      };
      await ApiService.markTrainingOpened(userId, material.id, userInfo);
      const p = await ApiService.getUserTrainingProgress(userId, material.id);
      if (mounted) setProgress(p);
    })();
    return () => { mounted = false; };
  }, [open, userId, material?.id, user]);

  // HTML5 video — timeupdate dinle, throttle ile her 5 sn'de bir progress gönder
  const handleTimeUpdate = useCallback(() => {
    if (!userId || !material?.id) return;
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const now = Date.now();
    if (now - lastSentRef.current < 5000) return; // 5 saniye throttle
    lastSentRef.current = now;
    ApiService.updateTrainingProgress(userId, material.id, v.currentTime, v.duration);
  }, [userId, material?.id]);

  // YouTube IFrame API — open olunca yükle, polling ile getCurrentTime
  useEffect(() => {
    if (!open) return;
    if (type !== 'video' || material?.video_source !== 'youtube') return;
    if (!userId || !material?.id) return;

    // YouTube API script bir kez yüklenir
    const ensureYTApi = () => new Promise((resolve) => {
      if (window.YT && window.YT.Player) return resolve();
      if (window._ytApiPending) {
        const check = setInterval(() => {
          if (window.YT && window.YT.Player) { clearInterval(check); resolve(); }
        }, 200);
        return;
      }
      window._ytApiPending = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => resolve();
    });

    let cancelled = false;
    ensureYTApi().then(() => {
      if (cancelled) return;
      const iframeEl = document.getElementById(`yt-player-${material.id}`);
      if (!iframeEl || !window.YT) return;
      try {
        ytPlayerRef.current = new window.YT.Player(iframeEl, {
          events: {
            onReady: () => {
              ytIntervalRef.current = setInterval(() => {
                try {
                  const p = ytPlayerRef.current;
                  if (!p || typeof p.getCurrentTime !== 'function') return;
                  const cur = p.getCurrentTime();
                  const dur = p.getDuration();
                  if (dur > 0) {
                    const now = Date.now();
                    if (now - lastSentRef.current >= 5000) {
                      lastSentRef.current = now;
                      ApiService.updateTrainingProgress(userId, material.id, cur, dur);
                    }
                  }
                } catch (_) { /* ignore */ }
              }, 3000);
            }
          }
        });
      } catch (e) {
        console.warn('YT Player init error:', e);
      }
    });

    return () => {
      cancelled = true;
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
      ytIntervalRef.current = null;
      try { ytPlayerRef.current?.destroy?.(); } catch (_) {}
      ytPlayerRef.current = null;
    };
  }, [open, type, material?.id, material?.video_source, userId]);

  const handleManualComplete = async () => {
    if (!userId || !material?.id) return;
    setMarking(true);
    try {
      // Eğer henüz açılmamışsa önce kayıt oluştur
      await ApiService.markTrainingOpened(userId, material.id, {
        name: user?.name || '',
        role: user?.role || '',
        phone: user?.phone || ''
      });
      await ApiService.markTrainingCompleted(userId, material.id);
      const p = await ApiService.getUserTrainingProgress(userId, material.id);
      setProgress(p);
    } catch (e) {
      console.error('Manuel tamamlama hatası:', e);
    } finally {
      setMarking(false);
    }
  };

  if (!material) return null;

  const isCompleted = !!progress?.completed_at;
  const progressPct = progress?.progress_percent || 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition overflow-hidden flex flex-col relative"
      >
        {isCompleted && (
          <span className="absolute top-2 left-2 z-10 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Tamamlandı
          </span>
        )}
        <div className="aspect-video bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center relative">
          {material.thumbnail_url ? (
            <img src={material.thumbnail_url} alt={material.title} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-16 h-16 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={badge.icon} />
            </svg>
          )}
          <span className={`absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full ${badge.cls} bg-opacity-95`}>
            {badge.label}
          </span>
        </div>
        <div className="p-4 flex-1">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base mb-1 line-clamp-2">
            {material.title || 'İsimsiz'}
          </h3>
          {material.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {material.description}
            </p>
          )}
          {/* Progress bar — eğer açıldı ve henüz tamamlanmadıysa */}
          {progress && !isCompleted && progressPct > 0 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">%{progressPct} izlendi</div>
            </div>
          )}
        </div>
      </button>

      {/* Viewer modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{material.title}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-900 text-2xl leading-none">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {material.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{material.description}</p>
              )}

              {type === 'video' && material.video_url && material.video_source === 'youtube' && (
                <div className="aspect-video w-full">
                  <iframe
                    id={`yt-player-${material.id}`}
                    src={youtubeEmbedUrl(material.video_url)}
                    title={material.title}
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              )}
              {type === 'video' && material.video_url && material.video_source === 'storage' && (
                <video
                  ref={videoRef}
                  controls
                  className="w-full rounded-lg"
                  src={material.video_url}
                  onTimeUpdate={handleTimeUpdate}
                />
              )}

              {type === 'pdf' && material.pdf_url && (
                <div>
                  <iframe src={material.pdf_url} title={material.title} className="w-full h-[60vh] rounded-lg border" />
                  <a
                    href={material.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
                  >
                    PDF'i ayrı sekmede aç ↗
                  </a>
                </div>
              )}

              {type === 'text' && material.text_content && (
                <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {material.text_content}
                </div>
              )}

              {/* Tamamlama durumu */}
              {userId && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between flex-wrap gap-2">
                  {isCompleted ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-sm">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Bu materyali tamamladınız
                      {progress?.completed_at && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                          ({new Date(progress.completed_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })})
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {type === 'video'
                          ? `Videoyu en az %80 izlediğinizde otomatik tamamlanır${progressPct > 0 ? ` — şu an %${progressPct}` : ''}.`
                          : 'Materyali okuduktan sonra "Okudum" butonuna basın.'}
                      </div>
                      <button
                        onClick={handleManualComplete}
                        disabled={marking}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                      >
                        {marking ? 'Kaydediliyor…' : (type === 'video' ? 'İzledim' : 'Okudum')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TrainingMaterialCard;
