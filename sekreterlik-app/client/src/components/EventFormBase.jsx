import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';

/**
 * EventFormBase - Unified event form component
 * Supports three modes via the `mode` prop:
 *   - 'create': Create a new event with attendance tracking
 *   - 'edit':   Edit an existing event with attendance tracking
 *   - 'plan':   Plan a future event (no attendance tracking)
 *
 * Props:
 *   mode: 'create' | 'edit' | 'plan'
 *   event: (edit mode only) existing event data to populate form
 *   onClose: callback when form is cancelled or after successful save
 *   onSuccess: callback after successful save (replaces onEventCreated/onEventSaved/onEventPlanned)
 *   members: array of members for attendance tracking (create/edit modes)
 */
const MODE_CONFIG = {
  create: {
    title: 'Etkinlik Oluştur',
    submitLabel: 'Etkinlik Oluştur',
    successMessage: 'Etkinlik başarıyla oluşturuldu',
    errorMessage: 'Etkinlik oluşturulurken bir hata oluştu',
    hasAttendance: true,
  },
  edit: {
    title: 'Etkinlik Düzenle',
    submitLabel: 'Etkinlik Güncelle',
    successMessage: 'Etkinlik başarıyla güncellendi',
    errorMessage: 'Etkinlik güncellenirken bir hata oluştu',
    hasAttendance: true,
  },
  plan: {
    title: 'Etkinlik Planla',
    submitLabel: 'Planla',
    successMessage: 'Etkinlik başarıyla planlandı',
    errorMessage: 'Etkinlik planlanırken hata oluştu',
    hasAttendance: false,
  },
};

const LOCATION_TYPE_LABELS = {
  district: 'İlçe',
  town: 'Belde',
  neighborhood: 'Mahalle',
  village: 'Köy',
  stk: 'STK',
  public_institution: 'Kamu Kurumu',
  mosque: 'Cami',
};

const LOCATION_TYPES = Object.keys(LOCATION_TYPE_LABELS);

const EventFormBase = ({ mode = 'create', event, onClose, onSuccess, members }) => {
  const toast = useToast();
  const config = MODE_CONFIG[mode];

  // Form state
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [attendance, setAttendance] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [eventCategories, setEventCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Location selection states
  const [selectedLocationTypes, setSelectedLocationTypes] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState({});
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [stks, setStks] = useState([]);
  const [publicInstitutions, setPublicInstitutions] = useState([]);
  const [mosques, setMosques] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [responsibleMembers, setResponsibleMembers] = useState([]);
  const [loadingResponsibleMembers, setLoadingResponsibleMembers] = useState(false);

  // Search terms for location selection
  const [locationSearchTerms, setLocationSearchTerms] = useState(
    Object.fromEntries(LOCATION_TYPES.map(t => [t, '']))
  );

  // ===================== Data loading =====================
  useEffect(() => {
    fetchEventCategories();
    fetchLocationData();
  }, []);

  const fetchEventCategories = async () => {
    setLoadingCategories(true);
    try {
      const categories = await ApiService.getEventCategories();
      setEventCategories(categories || []);
    } catch (error) {
      console.error('Error fetching event categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchLocationData = async () => {
    setLoadingLocations(true);
    try {
      const [d, t, n, v, s, pi, m] = await Promise.all([
        ApiService.getDistricts().catch(() => []),
        ApiService.getTowns().catch(() => []),
        ApiService.getNeighborhoods().catch(() => []),
        ApiService.getVillages().catch(() => []),
        ApiService.getSTKs().catch(() => []),
        ApiService.getPublicInstitutions().catch(() => []),
        ApiService.getMosques().catch(() => []),
      ]);
      setDistricts(d || []);
      setTowns(t || []);
      setNeighborhoods(n || []);
      setVillages(v || []);
      setStks(s || []);
      setPublicInstitutions(pi || []);
      setMosques(m || []);
    } catch (error) {
      console.error('Error fetching location data:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  // ===================== Edit mode: populate from event =====================
  useEffect(() => {
    if (mode === 'edit' && event) {
      setEventName(event.name || '');
      if (event.date) {
        const dateObj = new Date(event.date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        setEventDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      }
      setEventDescription(event.description || '');
      if (event.category_id) setSelectedCategoryId(String(event.category_id));
      if (event.selectedLocationTypes?.length > 0) setSelectedLocationTypes(event.selectedLocationTypes);
      if (event.selectedLocations) setSelectedLocations(event.selectedLocations);
      if (event.attendees) {
        const initialAttendance = {};
        event.attendees.forEach(attendee => {
          const memberId = String(attendee.memberId);
          let status = 'notAttended';
          if (attendee.excuse?.hasExcuse) {
            status = 'excused';
          } else if (attendee.attended === true) {
            status = 'attended';
          }
          initialAttendance[memberId] = { status, excuseReason: attendee.excuse?.reason || '' };
        });
        setAttendance(initialAttendance);
      }
    }
  }, [event, mode]);

  // ===================== Location helpers =====================
  const allLocationData = { district: districts, town: towns, neighborhood: neighborhoods, village: villages, stk: stks, public_institution: publicInstitutions, mosque: mosques };

  const getFilteredOptions = (type) => {
    const selectedDistrictIds = selectedLocations.district || [];
    const selectedTownIds = selectedLocations.town || [];
    const selectedNeighborhoodIds = selectedLocations.neighborhood || [];
    const selectedVillageIds = selectedLocations.village || [];
    const searchVal = locationSearchTerms[type] || '';
    let filtered = [];

    switch (type) {
      case 'town':
        filtered = selectedDistrictIds.length === 0 ? towns : towns.filter(t => selectedDistrictIds.includes(t.district_id));
        break;
      case 'neighborhood': {
        let base = neighborhoods;
        if (selectedDistrictIds.length > 0) base = base.filter(n => selectedDistrictIds.includes(n.district_id));
        if (selectedTownIds.length > 0 && base.length > 0 && 'town_id' in (base[0] || {})) base = base.filter(n => selectedTownIds.includes(n.town_id));
        filtered = base;
        break;
      }
      case 'village': {
        let base = villages;
        if (selectedDistrictIds.length > 0) base = base.filter(v => selectedDistrictIds.includes(v.district_id));
        if (selectedTownIds.length > 0 && base.length > 0 && 'town_id' in (base[0] || {})) base = base.filter(v => selectedTownIds.includes(v.town_id));
        filtered = base;
        break;
      }
      case 'mosque': {
        let base = mosques;
        if (selectedDistrictIds.length > 0) base = base.filter(m => selectedDistrictIds.includes(m.district_id));
        if (selectedNeighborhoodIds.length > 0 && base.length > 0 && 'neighborhood_id' in (base[0] || {})) base = base.filter(m => selectedNeighborhoodIds.includes(m.neighborhood_id));
        if (selectedVillageIds.length > 0 && base.length > 0 && 'village_id' in (base[0] || {})) base = base.filter(m => selectedVillageIds.includes(m.village_id));
        filtered = base;
        break;
      }
      case 'district':
        filtered = districts;
        break;
      case 'stk':
        filtered = (selectedDistrictIds.length > 0 && stks.length > 0 && 'district_id' in (stks[0] || {}))
          ? stks.filter(s => selectedDistrictIds.includes(s.district_id)) : stks;
        break;
      case 'public_institution':
        filtered = (selectedDistrictIds.length > 0 && publicInstitutions.length > 0 && 'district_id' in (publicInstitutions[0] || {}))
          ? publicInstitutions.filter(pi => selectedDistrictIds.includes(pi.district_id)) : publicInstitutions;
        break;
      default:
        return [];
    }

    if (searchVal?.trim()) {
      const s = searchVal.toLowerCase().trim();
      filtered = filtered.filter(o => o.name?.toLowerCase().includes(s));
    }
    return filtered;
  };

  const handleLocationSearchChange = (locationType, value) => {
    setLocationSearchTerms(prev => ({ ...prev, [locationType]: value }));
  };

  const handleLocationTypeChange = (locationType) => {
    setSelectedLocationTypes(prev => {
      if (prev.includes(locationType)) {
        setSelectedLocations(p => { const n = { ...p }; delete n[locationType]; return n; });
        return prev.filter(t => t !== locationType);
      }
      return [...prev, locationType];
    });
  };

  const handleLocationSelection = (locationType, locationId, isChecked) => {
    setSelectedLocations(prev => {
      const current = prev[locationType] || [];
      if (isChecked) {
        return current.includes(locationId) ? prev : { ...prev, [locationType]: [...current, locationId] };
      }
      return { ...prev, [locationType]: current.filter(id => id !== locationId) };
    });
  };

  const getLocationName = (locationType, locationId) => {
    if (!locationId) return '';
    const list = allLocationData[locationType] || [];
    const item = list.find(x => x.id === locationId);
    return item ? item.name : '';
  };

  const generateEventLocation = () => {
    return selectedLocationTypes
      .map(type => {
        const ids = selectedLocations[type] || [];
        return ids.map(id => getLocationName(type, id)).filter(Boolean).join(', ');
      })
      .filter(Boolean)
      .join(', ');
  };

  // ===================== Responsible members (create/edit only) =====================
  const getResponsibleMembers = async () => {
    const result = [];
    try {
      const [districtOfficials, townOfficials, neighborhoodReps, villageReps, neighborhoodSups, villageSups, districtDeputyInsp, townDeputyInsp] = await Promise.all([
        ApiService.getDistrictOfficials(), ApiService.getTownOfficials(),
        ApiService.getNeighborhoodRepresentatives(), ApiService.getVillageRepresentatives(),
        ApiService.getNeighborhoodSupervisors(), ApiService.getVillageSupervisors(),
        ApiService.getAllDistrictDeputyInspectors(), ApiService.getAllTownDeputyInspectors(),
      ]);

      selectedLocationTypes.forEach(locationType => {
        const locationIds = selectedLocations[locationType] || [];
        if (locationIds.length === 0) return;
        locationIds.forEach(locationId => {
          let responsible = [];
          switch (locationType) {
            case 'district': {
              const officials = districtOfficials.filter(o => o.district_id === locationId);
              const deputies = districtDeputyInsp.filter(d => d.district_id === locationId);
              officials.forEach(o => {
                if (o.chairman_member_id) responsible.push({ id: o.chairman_member_id, name: o.chairman_name, position: 'İlçe Başkanı', region: o.district_name, phone: o.chairman_phone });
                if (o.inspector_member_id) responsible.push({ id: o.inspector_member_id, name: o.inspector_name, position: 'İlçe Müfettişi', region: o.district_name, phone: o.inspector_phone });
              });
              deputies.forEach(d => responsible.push({ id: d.member_id, name: d.member_name || d.name, position: 'İlçe Müfettiş Yardımcısı', region: d.district_name, phone: d.member_phone || d.phone }));
              break;
            }
            case 'town': {
              const officials = townOfficials.filter(o => o.town_id === locationId);
              const deputies = townDeputyInsp.filter(d => d.town_id === locationId);
              officials.forEach(o => {
                if (o.chairman_member_id) responsible.push({ id: o.chairman_member_id, name: o.chairman_name, position: 'Belde Başkanı', region: o.town_name, phone: o.chairman_phone });
                if (o.inspector_member_id) responsible.push({ id: o.inspector_member_id, name: o.inspector_name, position: 'Belde Müfettişi', region: o.town_name, phone: o.inspector_phone });
              });
              deputies.forEach(d => responsible.push({ id: d.member_id, name: d.member_name || d.name, position: 'Belde Müfettiş Yardımcısı', region: d.town_name, phone: d.member_phone || d.phone }));
              break;
            }
            case 'neighborhood': {
              neighborhoodReps.filter(r => r.neighborhood_id === locationId).forEach(r => responsible.push({ id: r.member_id, name: r.name, position: 'Mahalle Temsilcisi', region: r.neighborhood_name, phone: r.phone }));
              neighborhoodSups.filter(s => s.neighborhood_id === locationId).forEach(s => responsible.push({ id: s.member_id, name: s.name, position: 'Mahalle Sorumlusu', region: s.neighborhood_name, phone: s.phone }));
              break;
            }
            case 'village': {
              villageReps.filter(r => r.village_id === locationId).forEach(r => responsible.push({ id: r.member_id, name: r.name, position: 'Köy Temsilcisi', region: r.village_name, phone: r.phone }));
              villageSups.filter(s => s.village_id === locationId).forEach(s => responsible.push({ id: s.member_id, name: s.name, position: 'Köy Sorumlusu', region: s.village_name, phone: s.phone }));
              break;
            }
          }
          result.push(...responsible);
        });
      });

      return result.filter((m, i, self) => i === self.findIndex(x => x.id === m.id));
    } catch (error) {
      console.error('Error fetching responsible members:', error);
      return [];
    }
  };

  // Filter and sort members (for attendance tracking)
  const filteredMembers = members ? members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.region?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const otherMembers = filteredMembers.filter(m => !responsibleMembers.some(r => r.id === m.id));
  const sortedMembers = [
    ...responsibleMembers.sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' })),
    ...otherMembers.sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' })),
  ];

  // Load responsible members when locations change (only for attendance modes)
  useEffect(() => {
    if (!config.hasAttendance) return;

    const load = async () => {
      if (selectedLocationTypes.length === 0 || Object.values(selectedLocations).every(arr => arr.length === 0)) {
        setResponsibleMembers([]);
        return;
      }
      setLoadingResponsibleMembers(true);
      try {
        const responsible = await getResponsibleMembers();
        setResponsibleMembers(responsible);
        setAttendance(prev => {
          const next = { ...prev };
          responsible.forEach(m => {
            const sid = String(m.id);
            if (!(sid in next)) next[sid] = { status: 'attended', excuseReason: '' };
          });
          return next;
        });
      } catch (error) {
        console.error('Error loading responsible members:', error);
        setResponsibleMembers([]);
      } finally {
        setLoadingResponsibleMembers(false);
      }
    };
    load();
  }, [selectedLocationTypes, selectedLocations]);

  // ===================== Attendance helpers =====================
  const handleAttendanceChange = (memberId, status) => {
    const sid = String(memberId);
    setAttendance(prev => ({
      ...prev,
      [sid]: { ...(prev[sid] || {}), status, excuseReason: status === 'excused' ? (prev[sid]?.excuseReason || '') : '' },
    }));
  };

  const handleExcuseReasonChange = (memberId, reason) => {
    const sid = String(memberId);
    setAttendance(prev => ({ ...prev, [sid]: { ...(prev[sid] || {}), excuseReason: reason } }));
  };

  const getAttendanceStatus = (memberId) => {
    const sid = String(memberId);
    const d = attendance[sid];
    if (!d) return 'notAttended';
    if (typeof d === 'boolean') return d ? 'attended' : 'notAttended';
    return d.status || 'notAttended';
  };

  // ===================== Submit =====================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId) { toast.warning('Etkinlik kategorisi seçilmelidir'); return; }
    if (!eventDate) { toast.warning('Etkinlik tarihi ve saati zorunludur'); return; }
    if (selectedLocationTypes.length === 0) { toast.warning('En az bir konum türü seçilmelidir'); return; }

    if (config.hasAttendance) {
      const missing = selectedLocationTypes.filter(t => !selectedLocations[t] || selectedLocations[t].length === 0);
      if (missing.length > 0) { toast.warning('Seçilen konum türleri için en az bir konum seçimi yapılmalıdır'); return; }
    }

    try {
      const selectedCategory = eventCategories.find(cat => cat.id === parseInt(selectedCategoryId));
      const finalEventName = selectedCategory ? selectedCategory.name : (eventName || '');
      const finalLocation = generateEventLocation();

      const eventData = {
        name: finalEventName,
        category_id: selectedCategoryId,
        date: eventDate,
        location: finalLocation,
        description: eventDescription,
        selectedLocationTypes,
        selectedLocations,
      };

      if (config.hasAttendance) {
        eventData.attendees = sortedMembers.map(member => {
          const memberId = String(member.id);
          const attData = attendance[memberId];
          let attended = false;
          let excuse = { hasExcuse: false, reason: '' };
          if (typeof attData === 'object' && attData !== null) {
            attended = attData.status === 'attended';
            if (attData.status === 'excused') excuse = { hasExcuse: true, reason: attData.excuseReason || '' };
          } else {
            attended = attData === true;
          }
          return { memberId, attended, excuse };
        });
      } else {
        eventData.isPlanned = true;
        eventData.attendees = [];
      }

      let response;
      if (mode === 'edit') {
        response = await ApiService.updateEvent(event.id, eventData);
      } else {
        response = await ApiService.createEvent(eventData);

        // Process visit counts for create mode
        if (mode === 'create' && response?.id) {
          try {
            await ApiService.processEventLocations(response.id, selectedLocationTypes, selectedLocations);
          } catch (visitError) {
            console.error('Error updating visit counts:', visitError);
          }
        }
      }

      toast.success(config.successMessage);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (error) {
      console.error(`Error in ${mode} event:`, error);

      // QUIC hata toleransı (plan modu)
      if (mode === 'plan' && error.message?.includes('QUIC')) {
        toast.warning('Etkinlik planlandı (bağlantı uyarısı alındı, lütfen kontrol edin)');
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } else {
        toast.error(`${config.errorMessage}: ${error.message || 'Bilinmeyen hata'}`);
      }
    }
  };

  // ===================== Render =====================
  if (mode === 'plan') {
    // Simplified plan form (no attendance section)
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{config.title}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Etkinlik Kategorisi <span className="text-red-500">*</span>
            </label>
            <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
              <option value="">Kategori seçin...</option>
              {eventCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tarih ve Saat <span className="text-red-500">*</span>
            </label>
            <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required />
          </div>

          {/* Location Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Konum Türleri <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {LOCATION_TYPES.map(type => (
                <label key={type} className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={selectedLocationTypes.includes(type)} onChange={() => handleLocationTypeChange(type)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{LOCATION_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Location selections per type */}
          {selectedLocationTypes.map(type => {
            const locations = allLocationData[type] || [];
            return (
              <div key={type}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{LOCATION_TYPE_LABELS[type]} Seçimi</label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2">
                  {locations.map(loc => (
                    <label key={loc.id} className="flex items-center space-x-2 p-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input type="checkbox" checked={(selectedLocations[type] || []).includes(String(loc.id))}
                        onChange={() => handleLocationSelection(type, String(loc.id), !(selectedLocations[type] || []).includes(String(loc.id)))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{loc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Açıklama</label>
            <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Etkinlik açıklaması..." />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition duration-200">
              İptal
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition duration-200">
              {config.submitLabel}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ===================== Create / Edit form (with attendance) =====================
  return (
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 md:space-y-6">
      {/* Category + Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-6">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
            Etkinlik Kategorisi *
          </label>
          <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required disabled={loadingCategories}>
            <option value="">{loadingCategories ? 'Kategoriler yükleniyor...' : 'Etkinlik kategorisi seçin'}</option>
            {eventCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {eventCategories.length === 0 && !loadingCategories && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Henüz etkinlik kategorisi eklenmemiş. Lütfen önce ayarlar sayfasından etkinlik kategorisi ekleyin.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
            Etkinlik Tarihi ve Saati *
          </label>
          <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required />
        </div>
      </div>

      {/* Location Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Etkinlik Yeri *</label>
        <div className="mb-4">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">Konum türü seçin:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {LOCATION_TYPES.map(key => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={selectedLocationTypes.includes(key)} onChange={() => handleLocationTypeChange(key)}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700" disabled={loadingLocations} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{LOCATION_TYPE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>

        {selectedLocationTypes.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Seçilen konum türleri için detay seçin:</p>
            {selectedLocationTypes.map(locationType => {
              const options = getFilteredOptions(locationType);
              return (
                <div key={locationType} className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{LOCATION_TYPE_LABELS[locationType]}:</label>
                  {(locationType === 'neighborhood' || locationType === 'village') && (
                    <input type="text" placeholder={`${LOCATION_TYPE_LABELS[locationType]} ara...`}
                      value={locationSearchTerms[locationType] || ''} onChange={(e) => handleLocationSearchChange(locationType, e.target.value)}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                  )}
                  <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 space-y-1 bg-white dark:bg-gray-700">
                    {options.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">{locationSearchTerms[locationType] ? 'Arama sonucu bulunamadı' : 'Seçenek bulunamadı'}</p>
                    ) : options.map(option => (
                      <label key={option.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded">
                        <input type="checkbox" checked={(selectedLocations[locationType] || []).includes(option.id)}
                          onChange={(e) => handleLocationSelection(locationType, option.id, e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{option.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Responsible Members Selection */}
      {responsibleMembers.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Sorumlu Kişilerin Katılım Durumu</label>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">Seçilen konumlardaki sorumlu kişilerin katılım durumunu belirleyin:</p>
            <div className="space-y-3">
              {responsibleMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">{member.position}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{member.region}</div>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-4">
                      {[
                        { val: 'attended', label: 'Katıldı', color: 'green' },
                        { val: 'notAttended', label: 'Katılmadı', color: 'red' },
                        { val: 'excused', label: 'Mazeretli', color: 'amber' },
                      ].map(({ val, label, color }) => (
                        <label key={val} className="flex items-center">
                          <input type="radio" name={`responsible_${member.id}`} checked={getAttendanceStatus(member.id) === val}
                            onChange={() => handleAttendanceChange(member.id, val)}
                            className={`h-4 w-4 text-${color}-600 focus:ring-${color}-500 border-gray-300 dark:border-gray-600`} />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{label}</span>
                        </label>
                      ))}
                    </div>
                    {getAttendanceStatus(member.id) === 'excused' && (
                      <input type="text" value={attendance[String(member.id)]?.excuseReason || ''}
                        onChange={(e) => handleExcuseReasonChange(member.id, e.target.value)} placeholder="Mazeret sebebi"
                        className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Açıklama</label>
        <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} rows={3}
          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="Etkinlik hakkında detaylı bilgi..." />
      </div>

      {/* Attendance Section */}
      <div>
        <div className="flex justify-between items-center mb-2 sm:mb-4">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">Katılım Durumu</h3>
          {responsibleMembers.length > 0 && (
            <span className="text-sm text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 px-2 py-1 rounded-full">
              {responsibleMembers.length} sorumlu kişi
            </span>
          )}
        </div>
        <div className="mb-2 sm:mb-4">
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Üye ara (isim, görev, bölge)..."
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3 md:p-4 max-h-64 sm:max-h-96 overflow-y-auto">
          <div className="space-y-2 sm:space-y-3">
            {sortedMembers.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                {searchTerm ? 'Arama kriterlerine uygun üye bulunamadı' : 'Üye bulunamadı'}
              </div>
            ) : sortedMembers.map(member => {
              const isResponsible = responsibleMembers.some(r => r.id === member.id);
              return (
                <div key={member.id} className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border ${
                  isResponsible ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                      {isResponsible && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">Sorumlu</span>}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{member.position} - {member.region}</div>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-3">
                      {[
                        { val: 'attended', label: 'Katıldı', color: 'green' },
                        { val: 'notAttended', label: 'Katılmadı', color: 'red' },
                        { val: 'excused', label: 'Mazeretli', color: 'amber' },
                      ].map(({ val, label, color }) => (
                        <label key={val} className="flex items-center">
                          <input type="radio" name={`member_att_${member.id}`} checked={getAttendanceStatus(member.id) === val}
                            onChange={() => handleAttendanceChange(member.id, val)}
                            className={`h-4 w-4 text-${color}-600 focus:ring-${color}-500 border-gray-300 dark:border-gray-600`} />
                          <span className="ml-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">{label}</span>
                        </label>
                      ))}
                    </div>
                    {getAttendanceStatus(member.id) === 'excused' && (
                      <input type="text" value={attendance[String(member.id)]?.excuseReason || ''}
                        onChange={(e) => handleExcuseReasonChange(member.id, e.target.value)} placeholder="Mazeret sebebi"
                        className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 pb-4 sm:pb-0 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 -mx-4 sm:-mx-6 px-4 sm:px-6 mt-4 sm:mt-0">
        <button type="button" onClick={onClose}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200">
          İptal
        </button>
        <button type="submit"
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors duration-200">
          {config.submitLabel}
        </button>
      </div>
    </form>
  );
};

export default EventFormBase;
