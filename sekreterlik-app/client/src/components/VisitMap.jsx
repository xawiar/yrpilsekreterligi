import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import ApiService from '../utils/ApiService';
import elazigDistricts from '../data/elazigDistricts.json';

// Leaflet default icon fix
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Ziyaret oranina gore renk belirle
const getColor = (visitRate) => {
  if (visitRate >= 80) return '#22c55e'; // yesil
  if (visitRate >= 60) return '#84cc16'; // acik yesil
  if (visitRate >= 40) return '#eab308'; // sari
  if (visitRate >= 20) return '#f97316'; // turuncu
  return '#ef4444'; // kirmizi
};

const getOpacity = (visitRate) => {
  if (visitRate >= 80) return 0.7;
  if (visitRate >= 40) return 0.6;
  return 0.5;
};

// Harita bounds'unu GeoJSON'a gore ayarlayan yardimci component
const FitBoundsHelper = ({ geoJsonData }) => {
  const map = useMap();
  useEffect(() => {
    if (geoJsonData && geoJsonData.features && geoJsonData.features.length > 0) {
      try {
        const geoJsonLayer = L.geoJSON(geoJsonData);
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      } catch (e) {
        // fallback center
      }
    }
  }, [geoJsonData, map]);
  return null;
};

const VisitMap = ({ height = '500px', mini = false }) => {
  const [visitCounts, setVisitCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const geoJsonRef = useRef(null);

  // Ilce listesi
  const districts = useMemo(() => {
    return elazigDistricts.features.map(f => ({
      id: f.properties.id,
      name: f.properties.name
    }));
  }, []);

  // Ziyaret verilerini cek
  useEffect(() => {
    fetchVisitCounts();
  }, []);

  const fetchVisitCounts = async () => {
    try {
      setLoading(true);
      // Farkli lokasyon tipleri icin ziyaret verilerini cek
      const types = ['district', 'town', 'neighborhood', 'village'];
      const allCounts = {};

      for (const type of types) {
        try {
          const counts = await ApiService.getAllVisitCounts(type);
          if (Array.isArray(counts)) {
            counts.forEach(c => {
              const key = (c.name || c.locationName || '').toLowerCase().trim();
              if (key) {
                allCounts[key] = (allCounts[key] || 0) + (c.count || c.visitCount || 0);
              }
            });
          } else if (counts && typeof counts === 'object') {
            Object.entries(counts).forEach(([key, val]) => {
              const k = key.toLowerCase().trim();
              allCounts[k] = (allCounts[k] || 0) + (typeof val === 'number' ? val : (val?.count || 0));
            });
          }
        } catch (e) {
          // Bu tip icin veri yoksa devam et
        }
      }

      setVisitCounts(allCounts);
    } catch (error) {
      console.error('Error fetching visit counts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrelenmis GeoJSON
  const filteredGeoJson = useMemo(() => {
    if (selectedDistrict === 'all') return elazigDistricts;
    return {
      ...elazigDistricts,
      features: elazigDistricts.features.filter(
        f => f.properties.id === selectedDistrict
      )
    };
  }, [selectedDistrict]);

  // Toplam ziyaret sayisi (istatistik icin)
  const totalVisits = useMemo(() => {
    return Object.values(visitCounts).reduce((sum, count) => sum + count, 0);
  }, [visitCounts]);

  // En cok ziyaret edilen ilce
  const maxVisitDistrict = useMemo(() => {
    let maxName = '-';
    let maxCount = 0;
    districts.forEach(d => {
      const count = visitCounts[d.name.toLowerCase()] || 0;
      if (count > maxCount) {
        maxCount = count;
        maxName = d.name;
      }
    });
    return { name: maxName, count: maxCount };
  }, [visitCounts, districts]);

  // GeoJSON style fonksiyonu (Item 7: mahalle bazli renklendirme)
  const getStyle = (feature) => {
    const name = (feature.properties.name || '').toLowerCase();
    const visitCount = visitCounts[name] || 0;
    // Oran hesabi: toplam ziyaret varsa yuzdelik, yoksa ham sayi bazli
    const maxPossible = Math.max(totalVisits * 0.3, 10); // ortalama referans
    const visitRate = totalVisits > 0
      ? Math.min((visitCount / maxPossible) * 100, 100)
      : 0;

    return {
      fillColor: getColor(visitRate),
      weight: 2,
      opacity: 1,
      color: '#374151',
      dashArray: '',
      fillOpacity: getOpacity(visitRate)
    };
  };

  // GeoJSON onEachFeature (Item 8: tooltip/popup)
  const onEachFeature = (feature, layer) => {
    const name = feature.properties.name;
    const visitCount = visitCounts[(name || '').toLowerCase()] || 0;
    const maxPossible = Math.max(totalVisits * 0.3, 10);
    const visitRate = totalVisits > 0
      ? Math.min(Math.round((visitCount / maxPossible) * 100), 100)
      : 0;

    // Tooltip
    layer.bindTooltip(
      `<div style="text-align:center;min-width:120px;">
        <strong>${name}</strong><br/>
        <span>Ziyaret: ${visitCount}</span><br/>
        <span>Oran: %${visitRate}</span>
      </div>`,
      {
        sticky: true,
        className: 'visit-map-tooltip'
      }
    );

    // Popup (daha detayli bilgi)
    layer.bindPopup(
      `<div style="min-width:150px;">
        <h3 style="margin:0 0 8px;font-weight:bold;font-size:14px;">${name}</h3>
        <table style="width:100%;font-size:12px;">
          <tr><td>Ziyaret Sayisi:</td><td style="text-align:right;font-weight:bold;">${visitCount}</td></tr>
          <tr><td>Ziyaret Orani:</td><td style="text-align:right;font-weight:bold;">%${visitRate}</td></tr>
        </table>
      </div>`
    );

    // Hover efektleri
    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({
          weight: 3,
          color: '#1e40af',
          fillOpacity: 0.8
        });
        l.bringToFront();
      },
      mouseout: (e) => {
        if (geoJsonRef.current) {
          geoJsonRef.current.resetStyle(e.target);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg`} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Item 9: Filtreler (mini modda gizle) */}
      {!mini && (
        <div className="flex flex-wrap gap-3">
          {/* Ilce filtresi */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Ilce
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">Tum Ilceler</option>
              {districts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Tarih filtresi */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Tarih Araligi
            </label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">Tum Zamanlar</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="quarter">Son 3 Ay</option>
              <option value="year">Bu Yil</option>
            </select>
          </div>

          {/* Yenile butonu */}
          <div className="flex items-end">
            <button
              onClick={fetchVisitCounts}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Yenile
            </button>
          </div>
        </div>
      )}

      {/* Istatistik ozeti (mini modda gizle) */}
      {!mini && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{totalVisits}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Toplam Ziyaret</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{districts.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Ilce Sayisi</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{maxVisitDistrict.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">En Cok Ziyaret</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{maxVisitDistrict.count}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">En Yuksek</div>
          </div>
        </div>
      )}

      {/* Harita */}
      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height }}>
        <MapContainer
          center={[38.68, 39.22]}
          zoom={9}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={!mini}
          dragging={!mini ? true : false}
          zoomControl={!mini}
          attributionControl={!mini}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution={mini ? '' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}
          />
          <GeoJSON
            key={selectedDistrict + JSON.stringify(visitCounts)}
            ref={geoJsonRef}
            data={filteredGeoJson}
            style={getStyle}
            onEachFeature={onEachFeature}
          />
          <FitBoundsHelper geoJsonData={filteredGeoJson} />
        </MapContainer>
      </div>

      {/* Renk aciklamasi (mini modda gizle) */}
      {!mini && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">Renk Olcegi:</span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></span> %0-20
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded" style={{ backgroundColor: '#f97316' }}></span> %20-40
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded" style={{ backgroundColor: '#eab308' }}></span> %40-60
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded" style={{ backgroundColor: '#84cc16' }}></span> %60-80
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded" style={{ backgroundColor: '#22c55e' }}></span> %80-100
          </span>
        </div>
      )}
    </div>
  );
};

export default VisitMap;
