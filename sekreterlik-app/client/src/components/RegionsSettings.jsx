import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from './UI/ConfirmDialog';

const RegionsSettings = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [regions, setRegions] = useState([]);
  const [newRegion, setNewRegion] = useState('');
  const [editingRegion, setEditingRegion] = useState(null);
  const [editRegionName, setEditRegionName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      setLoading(true);
      const regionsData = await ApiService.getRegions();
      setRegions(regionsData);
    } catch (error) {
      console.error('Error fetching regions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRegion = async () => {
    if (newRegion.trim() !== '') {
      try {
        const regionData = { name: newRegion.trim() };
        const newRegionData = await ApiService.createRegion(regionData);
        
        // createRegion artık tam region objesi döndürüyor (id ve name ile)
        // ID'yi string'e çevir ve formatı garantile
        const regionToAdd = newRegionData && newRegionData.id && newRegionData.name
          ? { ...newRegionData, id: String(newRegionData.id) }
          : { id: String(newRegionData?.id || Date.now()), name: newRegion.trim() };

        // Optimistic update: add to UI immediately
        setRegions([...regions, regionToAdd]);
        setNewRegion('');
        
        // Fetch fresh data to ensure consistency (biraz bekle)
        setTimeout(async () => {
          await fetchRegions();
        }, 200);
      } catch (error) {
        console.error('Error adding region:', error);
        toast.error(error.message || 'Bölge eklenirken hata oluştu');
        // Refresh list on error
        await fetchRegions();
      }
    }
  };

  const handleDeleteRegion = async (id) => {
    const confirmed = await confirm({ title: 'Bölgeyi Sil', message: 'Bu bölgeyi silmek istediğinize emin misiniz?' });
    if (confirmed) {
      // Store original state for rollback
      const originalRegions = [...regions];

      try {
        // ID'yi güvenli şekilde string'e çevir
        let stringId;

        if (id === null || id === undefined) {
          throw new Error('Region ID bulunamadı (null veya undefined)');
        }

        if (typeof id === 'object') {
          if (id.id) {
            stringId = String(id.id);
          } else if (id.toString && typeof id.toString === 'function') {
            stringId = String(id.toString());
          } else {
            throw new Error(`Region ID geçersiz format: ${JSON.stringify(id)}`);
          }
        } else {
          stringId = String(id);
        }

        stringId = stringId.trim();

        // Boş string kontrolü
        if (!stringId || stringId === 'undefined' || stringId === 'null' || stringId === '[object Object]') {
          throw new Error(`Region ID geçersiz: ${id}`);
        }

        // Optimistic update: remove from UI immediately
        setRegions(regions.filter(r => {
          const rId = String(r.id || '').trim();
          return rId !== stringId;
        }));

        await ApiService.deleteRegion(stringId);

        // Fetch fresh data to ensure consistency
        await fetchRegions();
      } catch (error) {
        console.error('Error deleting region:', error);
        // Revert on error
        setRegions(originalRegions);
        // Fetch fresh data
        await fetchRegions();
        toast.error(error.message || 'Bölge silinirken hata oluştu');
      }
    }
  };

  const handleEditRegion = (region) => {
    // ID'yi string'e çevir
    const regionId = String(region.id || '');
    setEditingRegion(regionId);
    setEditRegionName(region.name);
  };

  const handleUpdateRegion = async () => {
    if (editRegionName.trim() !== '') {
      // Store original state for rollback
      const originalRegions = [...regions];
      const oldRegion = regions.find(r => r.id === editingRegion);
      
      try {
        // Optimistic update: update in UI immediately
        setRegions(regions.map(r => 
          r.id === editingRegion ? { ...r, name: editRegionName } : r
        ));
        
        const updatedRegion = await ApiService.updateRegion(editingRegion, { name: editRegionName });
        setEditingRegion(null);
        setEditRegionName('');
        
        // Fetch fresh data to ensure consistency
        await fetchRegions();
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('regionUpdated', { 
          detail: { 
            oldName: oldRegion?.name,
            newName: editRegionName 
          } 
        }));
        
        toast.success('Bölge başarıyla güncellendi ve tüm üyeler güncellendi');
      } catch (error) {
        console.error('Error updating region:', error);
        // Revert on error
        setRegions(originalRegions);
        // Fetch fresh data
        await fetchRegions();
        toast.error(error.message || 'Bölge güncellenirken hata oluştu');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingRegion(null);
    setEditRegionName('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition duration-300 hover:shadow-xl">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Bölgeler</h2>
      
      <div className="flex mb-4">
        <input
          type="text"
          value={newRegion}
          onChange={(e) => setNewRegion(e.target.value)}
          placeholder="Yeni bölge adı"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
        />
        <button
          onClick={handleAddRegion}
          className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white px-4 py-2 rounded-r-lg text-sm font-medium shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Ekle
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {regions.map((region) => (
            <li key={region.id} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-150">
              {editingRegion === region.id ? (
                <div className="flex-1 flex items-center space-x-2">
                  <input
                    type="text"
                    value={editRegionName}
                    onChange={(e) => setEditRegionName(e.target.value)}
                    className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateRegion}
                    className="text-green-600 hover:text-green-900 text-sm font-medium px-2 py-1 rounded hover:bg-green-50 transition duration-200"
                  >
                    Kaydet
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 text-sm font-medium px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-200"
                  >
                    İptal
                  </button>
                </div>
              ) : (
                <>
                  <span>{region.name}</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditRegion(region)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition duration-200"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDeleteRegion(region.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition duration-200"
                    >
                      Sil
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
          {regions.length === 0 && (
            <li className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center italic">
              Henüz bölge eklenmemiş
            </li>
          )}
        </ul>
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default RegionsSettings;