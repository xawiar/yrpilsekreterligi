import { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

/**
 * Shared hook for event location selection logic.
 * Used by CreateEventForm, EventForm, and PlanEventForm.
 * Extracts the common state and handlers for location type/selection management.
 */
const useEventLocations = () => {
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
  const [eventCategories, setEventCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [locationSearchTerms, setLocationSearchTerms] = useState({
    neighborhood: '',
    village: '',
    district: '',
    town: '',
    stk: '',
    public_institution: '',
    mosque: ''
  });

  const TYPE_LABELS = {
    district: 'Ilce',
    town: 'Belde',
    neighborhood: 'Mahalle',
    village: 'Koy',
    stk: 'STK',
    public_institution: 'Kamu Kurumu',
    mosque: 'Cami'
  };

  const LOCATION_TYPES = ['district', 'town', 'neighborhood', 'village', 'stk', 'public_institution', 'mosque'];

  const fetchEventCategories = async () => {
    try {
      setLoadingCategories(true);
      const categories = await ApiService.getEventCategories();
      setEventCategories(categories || []);
    } catch (error) {
      console.error('Error fetching event categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchLocations = async () => {
    try {
      setLoadingLocations(true);
      const [districtsData, townsData, neighborhoodsData, villagesData, stksData, publicInstitutionsData, mosquesData] = await Promise.all([
        ApiService.getDistricts().catch(() => []),
        ApiService.getTowns().catch(() => []),
        ApiService.getNeighborhoods().catch(() => []),
        ApiService.getVillages().catch(() => []),
        ApiService.getSTKs().catch(() => []),
        ApiService.getPublicInstitutions().catch(() => []),
        ApiService.getMosques().catch(() => [])
      ]);
      setDistricts(districtsData || []);
      setTowns(townsData || []);
      setNeighborhoods(neighborhoodsData || []);
      setVillages(villagesData || []);
      setStks(stksData || []);
      setPublicInstitutions(publicInstitutionsData || []);
      setMosques(mosquesData || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  useEffect(() => {
    fetchEventCategories();
    fetchLocations();
  }, []);

  const handleLocationTypeChange = (type) => {
    setSelectedLocationTypes(prev => {
      if (prev.includes(type)) {
        const newTypes = prev.filter(t => t !== type);
        setSelectedLocations(prevLocs => {
          const newLocs = { ...prevLocs };
          delete newLocs[type];
          return newLocs;
        });
        return newTypes;
      } else {
        return [...prev, type];
      }
    });
  };

  const handleLocationChange = (type, locationId) => {
    setSelectedLocations(prev => {
      const current = prev[type] || [];
      if (current.includes(locationId)) {
        return { ...prev, [type]: current.filter(id => id !== locationId) };
      } else {
        return { ...prev, [type]: [...current, locationId] };
      }
    });
  };

  const getLocationsForType = (type) => {
    switch (type) {
      case 'district': return districts;
      case 'town': return towns;
      case 'neighborhood': return neighborhoods;
      case 'village': return villages;
      case 'stk': return stks;
      case 'public_institution': return publicInstitutions;
      case 'mosque': return mosques;
      default: return [];
    }
  };

  const generateEventLocation = () => {
    const locationParts = [];
    selectedLocationTypes.forEach(type => {
      const locationIds = selectedLocations[type] || [];
      if (locationIds.length > 0) {
        const allLocations = getLocationsForType(type);
        const locations = allLocations
          .filter(loc => locationIds.includes(String(loc.id)))
          .map(loc => loc.name);
        if (locations.length > 0) {
          locationParts.push(`${TYPE_LABELS[type]}: ${locations.join(', ')}`);
        }
      }
    });
    return locationParts.join(' | ');
  };

  return {
    // State
    selectedLocationTypes,
    selectedLocations,
    districts,
    towns,
    neighborhoods,
    villages,
    stks,
    publicInstitutions,
    mosques,
    loadingLocations,
    eventCategories,
    loadingCategories,
    locationSearchTerms,
    // Setters (for initializing from existing event data)
    setSelectedLocationTypes,
    setSelectedLocations,
    setLocationSearchTerms,
    // Handlers
    handleLocationTypeChange,
    handleLocationChange,
    getLocationsForType,
    generateEventLocation,
    // Constants
    TYPE_LABELS,
    LOCATION_TYPES,
  };
};

export default useEventLocations;
