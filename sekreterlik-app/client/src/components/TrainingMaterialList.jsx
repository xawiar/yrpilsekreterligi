import React, { useEffect, useState } from 'react';
import ApiService from '../utils/ApiService';
import TrainingMaterialCard from './TrainingMaterialCard';

/**
 * Aktif eğitim materyallerini gösteren read-only liste.
 * Props:
 * - audience: 'chief_observer' | 'public'
 * - title (opsiyonel)
 * - emptyMessage (opsiyonel)
 */
const TrainingMaterialList = ({
  audience = 'chief_observer',
  title = 'Eğitim Materyalleri',
  emptyMessage = 'Henüz eğitim materyali eklenmedi.'
}) => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await ApiService.getTrainingMaterials(audience, true);
        if (mounted) setMaterials(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Eğitim materyalleri yüklenemedi:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [audience]);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Yükleniyor…</div>;
  }
  if (materials.length === 0) {
    return null; // Sessizce gizle (admin henüz materyal eklememişse boş alan görünmesin)
  }

  return (
    <div>
      {title && (
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Görev ve yetkilerinizi anlamak için lütfen aşağıdaki materyalleri inceleyin.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map((m) => (
          <TrainingMaterialCard key={m.id} material={m} />
        ))}
      </div>
    </div>
  );
};

export default TrainingMaterialList;
