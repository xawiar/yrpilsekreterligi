import React from 'react';

const SecimProvincialAssemblyForm = ({
  formData,
  provincialAssemblyPartyInput,
  setProvincialAssemblyPartyInput,
  handleAddProvincialAssemblyParty,
  handleRemoveProvincialAssemblyParty,
  provincialAssemblyCandidateInputs,
  setProvincialAssemblyCandidateInputs,
  handleAddProvincialAssemblyPartyCandidate,
  handleRemoveProvincialAssemblyPartyCandidate,
  districtInput,
  setDistrictInput,
  districtSeatsInput,
  setDistrictSeatsInput,
  setFormData,
}) => {
  return (
    <>
      {/* İl Genel Meclisi Partileri */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          İl Genel Meclisi Partileri *
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={provincialAssemblyPartyInput}
            onChange={(e) => setProvincialAssemblyPartyInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddProvincialAssemblyParty();
              }
            }}
            placeholder="Parti adı girin ve Enter'a basın"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleAddProvincialAssemblyParty}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Parti Ekle
          </button>
        </div>
        {formData.provincial_assembly_parties && formData.provincial_assembly_parties.length > 0 && (
          <div className="space-y-3 mt-3">
            {formData.provincial_assembly_parties.map((party, index) => {
              const partyName = typeof party === 'string' ? party : party.name;
              const partyCandidates = typeof party === 'object' && party.candidates ? party.candidates : [];
              return (
                <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-blue-800 dark:text-blue-200">{partyName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveProvincialAssemblyParty(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                    >
                      Partiyi Sil
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={provincialAssemblyCandidateInputs[index] || ''}
                      onChange={(e) => setProvincialAssemblyCandidateInputs(prev => ({ ...prev, [index]: e.target.value }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddProvincialAssemblyPartyCandidate(index);
                        }
                      }}
                      placeholder="Bu parti için aday adı girin ve Enter'a basın"
                      className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddProvincialAssemblyPartyCandidate(index)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                    >
                      Aday Ekle
                    </button>
                  </div>
                  {partyCandidates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {partyCandidates.map((candidate, candidateIndex) => (
                        <span
                          key={candidateIndex}
                          className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs"
                        >
                          {candidate}
                          <button
                            type="button"
                            onClick={() => handleRemoveProvincialAssemblyPartyCandidate(index, candidateIndex)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* İl Genel Meclisi İlçe Bazlı Üye Sayıları (D'Hondt için) */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          İl Genel Meclisi İlçe Bazlı Üye Sayıları (D'Hondt Hesaplaması için) *
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={districtInput}
            onChange={(e) => setDistrictInput(e.target.value)}
            placeholder="İlçe adı"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <input
            type="number"
            value={districtSeatsInput}
            onChange={(e) => setDistrictSeatsInput(e.target.value)}
            min="1"
            placeholder="Üye sayısı"
            className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => {
              if (districtInput.trim() && districtSeatsInput && parseInt(districtSeatsInput) > 0) {
                setFormData(prev => ({
                  ...prev,
                  provincial_assembly_district_seats: {
                    ...prev.provincial_assembly_district_seats,
                    [districtInput.trim()]: parseInt(districtSeatsInput)
                  }
                }));
                setDistrictInput('');
                setDistrictSeatsInput('');
              }
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Ekle
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
          Her ilçe için ayrı D'Hondt hesaplaması yapılacaktır. İlçe adı ve ��ye sayısını girin.
        </p>
        {formData.provincial_assembly_district_seats && Object.keys(formData.provincial_assembly_district_seats).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(formData.provincial_assembly_district_seats).map(([district, seats]) => (
              <span
                key={district}
                className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
              >
                {district}: {seats} üye
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => {
                      const newSeats = { ...prev.provincial_assembly_district_seats };
                      delete newSeats[district];
                      return {
                        ...prev,
                        provincial_assembly_district_seats: newSeats
                      };
                    });
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default SecimProvincialAssemblyForm;
