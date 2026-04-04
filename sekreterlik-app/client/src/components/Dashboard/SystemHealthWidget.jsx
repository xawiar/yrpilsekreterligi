import React, { useState, useEffect } from 'react';
import ApiService from '../../utils/ApiService';

const SystemHealthWidget = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${ApiService.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/health`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}g ${hours}s ${mins}d`;
    if (hours > 0) return `${hours}s ${mins}d`;
    return `${mins}d`;
  };

  if (loading && !health) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-3 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sistem Durumu</h3>
        <button
          onClick={fetchHealth}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Yenile
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
          <span className="text-sm">Sunucu erisilemedi</span>
        </div>
      ) : health ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${health.db === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Durum</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {health.db === 'ok' ? 'Calisir' : 'Sorun Var'}
              </p>
            </div>
          </div>

          {/* Uptime */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Calisma Suresi</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatUptime(health.uptimeSec)}
            </p>
          </div>

          {/* Memory */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Bellek (RSS)</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {health.rssMB} MB
            </p>
          </div>

          {/* DB Latency */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">DB Gecikmesi</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {health.dbLatencyMs != null ? `${health.dbLatencyMs} ms` : 'N/A'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SystemHealthWidget;
