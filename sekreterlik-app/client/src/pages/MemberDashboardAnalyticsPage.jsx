import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

const MemberDashboardAnalyticsPage = () => {
  const [summary, setSummary] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detailed'
  const [visitorCounts, setVisitorCounts] = useState({ total: 0, byElection: {} });

  useEffect(() => {
    fetchAnalytics();
    fetchVisitorCounts();
    
    // Update visitor counts every 10 seconds
    const interval = setInterval(() => {
      fetchVisitorCounts();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const [summaryResponse, analyticsResponse] = await Promise.all([
        ApiService.getAllAnalyticsSummary(),
        ApiService.getAllAnalytics()
      ]);

      if (summaryResponse.success) {
        setSummary(summaryResponse.summary || []);
      }

      if (analyticsResponse.success) {
        setAnalytics(analyticsResponse.analytics || []);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Analytics verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitorCounts = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';
      const response = await fetch(`${API_BASE_URL}/public/visitors/all-counts`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVisitorCounts({
            total: data.totalCount || 0,
            byElection: data.counts || {}
          });
        }
      }
    } catch (err) {
      console.error('Error fetching visitor counts:', err);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0 dk';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} sa ${minutes} dk`;
    }
    return `${minutes} dk`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">{error}</div>
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Üye Dashboard Analytics</h1>
          <p className="text-gray-600 text-sm">Üyelerin dashboard sayfası kullanım istatistikleri</p>
        </div>

        {/* Visitor Count Card */}
        <div className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">Anlık Seçim Sonuçları İzleyicileri</h2>
              <p className="text-indigo-100 text-sm">Public seçim sonuçları sayfasını izleyen kişi sayısı</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{visitorCounts.total}</div>
              <div className="text-indigo-100 text-sm">aktif izleyici</div>
            </div>
          </div>
          {Object.keys(visitorCounts.byElection).length > 0 && (
            <div className="mt-4 pt-4 border-t border-indigo-400/30">
              <p className="text-sm font-medium mb-2">Seçim Bazında:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(visitorCounts.byElection).map(([electionId, count]) => (
                  <div key={electionId} className="bg-white/20 rounded-lg px-3 py-1 text-sm">
                    Seçim {electionId}: <span className="font-bold">{count}</span> kişi
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'summary'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Özet Görünüm
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'detailed'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Detaylı Görünüm
          </button>
        </div>

        {/* Summary View */}
        {viewMode === 'summary' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Üye
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TC
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Toplam Giriş
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Toplam Süre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ortalama Süre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Toplam Sayfa Görüntüleme
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İlk Giriş
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Son Giriş
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summary.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      Henüz analytics verisi yok
                    </td>
                  </tr>
                ) : (
                  summary.map((item) => (
                    <tr key={item.member_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.name} {item.surname}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {item.tc || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {item.total_sessions || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(item.total_duration_seconds || 0)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(item.avg_duration_seconds || 0)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {item.total_page_views || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(item.first_session)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(item.last_session)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Detailed View */}
        {viewMode === 'detailed' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Üye
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TC
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Giriş Zamanı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Çıkış Zamanı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Süre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sayfa Görüntüleme
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      Henüz analytics verisi yok
                    </td>
                  </tr>
                ) : (
                  analytics
                    .sort((a, b) => {
                      const dateA = new Date(a.sessionStart || a.session_start || 0);
                      const dateB = new Date(b.sessionStart || b.session_start || 0);
                      return dateB - dateA;
                    })
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name} {item.surname}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {item.tc || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(item.sessionStart || item.session_start)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(item.sessionEnd || item.session_end) || 'Aktif'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatDuration(item.durationSeconds || item.duration_seconds || 0)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {item.pageViews || item.page_views || 0}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberDashboardAnalyticsPage;

