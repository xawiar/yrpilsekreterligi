import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { formatMemberName } from '../utils/nameFormatter';
import { isMobile } from '../utils/capacitorUtils';

const CreateMeetingForm = ({ regions, onClose, onMeetingCreated }) => {
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [meetingName, setMeetingName] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [excuse, setExcuse] = useState({});
  const [excuseReasons, setExcuseReasons] = useState({}); // Added state for excuse reasons
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedRegions.length > 0) {
      fetchMembersByRegions();
    } else {
      setMembers([]);
      setAttendance({});
    }
  }, [selectedRegions]);

  const fetchMembersByRegions = async () => {
    try {
      setLoading(true);
      // In a real implementation, you would filter members by regions on the server
      const allMembers = await ApiService.getMembers();
      const filteredMembers = allMembers.filter(member => 
        selectedRegions.includes(member.region)
      );
      
      // Sort members alphabetically by name (A to Z)
      const sortedMembers = [...filteredMembers].sort((a, b) => {
        return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
      });
      
      setMembers(sortedMembers);
      
      // Initialize attendance state - ID'leri string'e çevirerek tutarlılık sağla
      const initialAttendance = {};
      sortedMembers.forEach(member => {
        initialAttendance[String(member.id)] = true; // Default to attended
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = (regionName) => {
    setSelectedRegions(prev => {
      if (prev.includes(regionName)) {
        return prev.filter(r => r !== regionName);
      } else {
        return [...prev, regionName];
      }
    });
  };

  const handleAttendanceChange = (memberId, attended) => {
    // ID'yi string'e çevirerek tutarlılık sağla
    const stringId = String(memberId);
    setAttendance(prev => ({
      ...prev,
      [stringId]: attended
    }));
    
    // Reset excuse status when attendance is changed
    setExcuse(prev => ({
      ...prev,
      [stringId]: false
    }));
  };

  const handleExcuseChange = (memberId, excused) => {
    // ID'yi string'e çevirerek tutarlılık sağla
    const stringId = String(memberId);
    setExcuse(prev => ({
      ...prev,
      [stringId]: excused
    }));
    
    // Reset attendance status when excuse is changed
    setAttendance(prev => ({
      ...prev,
      [stringId]: false
    }));
  };

  // Added function to handle excuse reason changes
  const handleExcuseReasonChange = (memberId, reason) => {
    // ID'yi string'e çevirerek tutarlılık sağla
    const stringId = String(memberId);
    setExcuseReasons(prev => ({
      ...prev,
      [stringId]: reason
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!meetingName.trim()) {
      alert('Toplantı adı zorunludur');
      return;
    }
    
    if (selectedRegions.length === 0) {
      alert('En az bir bölge seçmelisiniz');
      return;
    }
    
    if (!meetingDate) {
      alert('Toplantı tarihi ve saati zorunludur');
      return;
    }
    
    try {
      // Create meeting
      const meetingData = {
        name: meetingName,
        regions: selectedRegions,
        notes: meetingNotes || '', // Empty string if no notes
        date: meetingDate,
        attendees: members.map(member => {
          // ID'leri string'e çevirerek tutarlılık sağla
          const memberId = String(member.id);
          const attended = attendance[memberId] === true;
          const hasExcuse = excuse[memberId] === true;
          const excuseReason = excuseReasons[memberId] || '';
          
          return {
            memberId: memberId, // String olarak sakla (Firebase ID'leri string)
            attended: attended && !hasExcuse, // If has excuse, not attended
            excuse: hasExcuse ? { 
              hasExcuse: true, 
              reason: excuseReason 
            } : { 
              hasExcuse: false, 
              reason: '' 
            }
          };
        })
      };
      
      console.log('Creating meeting with data:', meetingData);
      const response = await ApiService.createMeeting(meetingData);
      console.log('Meeting created successfully:', response);
      
      // Show success message
      alert('Toplantı başarıyla oluşturuldu');
      
      // Call callbacks
      if (onMeetingCreated) {
        onMeetingCreated();
      }
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Toplantı oluşturulurken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  const mobileView = isMobile();
  
  return (
    <div className={mobileView ? 'space-y-2 sm:space-y-6' : 'space-y-4 sm:space-y-6'}>
      <form onSubmit={handleSubmit}>
        <div className={mobileView ? 'space-y-2 sm:space-y-4' : 'space-y-3 sm:space-y-4'}>
          <div>
            <label className={`block ${mobileView ? 'text-[10px]' : 'text-xs'} sm:text-sm font-medium text-gray-700 dark:text-gray-300 ${mobileView ? 'mb-0.5' : 'mb-1'}`}>
              Toplantı Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              className={`w-full ${mobileView ? 'px-2 py-1 text-xs' : 'px-2 sm:px-3 py-1.5 sm:py-2'} ${mobileView ? '' : 'text-sm sm:text-base'} border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              placeholder="Toplantı adını girin"
              required
            />
          </div>

          <div>
            <label className={`block ${mobileView ? 'text-[10px]' : 'text-xs'} sm:text-sm font-medium text-gray-700 dark:text-gray-300 ${mobileView ? 'mb-0.5' : 'mb-1'}`}>
              Tarih ve Saat <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className={`w-full ${mobileView ? 'px-2 py-1 text-xs' : 'px-2 sm:px-3 py-1.5 sm:py-2'} ${mobileView ? '' : 'text-sm sm:text-base'} border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              required
            />
          </div>
          
          <div>
            <label className={`block ${mobileView ? 'text-[10px]' : 'text-xs'} sm:text-sm font-medium text-gray-700 dark:text-gray-300 ${mobileView ? 'mb-0.5' : 'mb-1'}`}>
              Bölgeler <span className="text-red-500">*</span>
            </label>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${mobileView ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
              {regions.map((region, idx) => (
              <label key={`${region.id ?? region.name}-${idx}`} className={`flex items-center ${mobileView ? 'p-1' : 'p-2 sm:p-3'} bg-white rounded-lg border border-gray-200 hover:border-indigo-300 transition duration-200 cursor-pointer`}>
                  <input
                    type="checkbox"
                    checked={selectedRegions.includes(region.name)}
                    onChange={() => handleRegionChange(region.name)}
                    className={`${mobileView ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded`}
                  />
                  <span className={`${mobileView ? 'ml-1 text-[10px]' : 'ml-1.5 sm:ml-2 text-xs sm:text-sm'} text-gray-700`}>{region.name}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className={`block ${mobileView ? 'text-[10px]' : 'text-xs'} sm:text-sm font-medium text-gray-700 dark:text-gray-300 ${mobileView ? 'mb-0.5' : 'mb-1'}`}>
              Toplantı Notları
            </label>
            <textarea
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              rows={mobileView ? 2 : 3}
              className={`w-full ${mobileView ? 'px-2 py-1 text-xs' : 'px-2 sm:px-3 py-1.5 sm:py-2'} ${mobileView ? '' : 'text-sm sm:text-base'} border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              placeholder="Toplantı notlarını girin"
            />
          </div>
          
          {selectedRegions.length > 0 && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Katılımcı Yoklaması
              </label>
              {loading ? (
                <div className="flex justify-center py-3 sm:py-4">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-indigo-600"></div>
                </div>
              ) : members.length > 0 ? (
                <div className="border rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-indigo-500 to-purple-600">
                      <tr>
                        <th className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                          Üye
                        </th>
                        <th className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                          Katılım
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {members.map(member => (
                        <tr key={member.id} className="hover:bg-gray-50 transition duration-150">
                          <td className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-xs sm:text-sm font-medium text-gray-900">
                            {formatMemberName(member.name)}
                          </td>
                          <td className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-xs sm:text-sm text-gray-500">
                            <div className="flex flex-col sm:flex-row sm:space-x-2 md:space-x-4 space-y-1 sm:space-y-0">
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`attendance-${member.id}`}
                                  checked={attendance[String(member.id)] === true}
                                  onChange={() => handleAttendanceChange(member.id, true)}
                                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="ml-1 text-xs sm:text-sm">Katıldı</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`attendance-${member.id}`}
                                  checked={attendance[String(member.id)] === false && !excuse[String(member.id)]}
                                  onChange={() => handleAttendanceChange(member.id, false)}
                                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="ml-1 text-xs sm:text-sm">Katılmadı</span>
                              </label>
                              {/* Updated excuse option with direct selection and reason field */}
                              <div className="flex flex-col">
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name={`attendance-${member.id}`}
                                    checked={excuse[String(member.id)] === true}
                                    onChange={() => handleExcuseChange(member.id, true)}
                                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 focus:ring-yellow-500"
                                  />
                                  <span className="ml-1 text-xs sm:text-sm">Mazeretli</span>
                                </label>
                                {excuse[String(member.id)] === true && (
                                  <input
                                    type="text"
                                    placeholder="Mazeret sebebi"
                                    value={excuseReasons[String(member.id)] || ''}
                                    onChange={(e) => handleExcuseReasonChange(member.id, e.target.value)}
                                    className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                  />
                                )}
                              </div>
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-2">Seçilen bölgelerde üye bulunamadı.</p>
              )}
            </div>
          )}
        </div>
        
        <div className={`flex flex-col sm:flex-row justify-end ${mobileView ? 'gap-1.5 pt-2' : 'gap-2 sm:gap-3 pt-4'} pb-4 sm:pb-0 sticky bottom-0 bg-white dark:bg-gray-800 -mx-4 sm:-mx-6 px-4 sm:px-6 border-t border-gray-200 dark:border-gray-700 ${mobileView ? 'mt-2' : 'mt-4 sm:mt-0'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto ${mobileView ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200`}
          >
            İptal
          </button>
          <button
            type="submit"
            className={`w-full sm:w-auto ${mobileView ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} bg-gradient-to-r from-indigo-600 to-purple-700 border border-transparent rounded-lg font-medium text-white hover:from-indigo-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition duration-200`}
          >
            Toplantıyı Kaydet
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateMeetingForm;