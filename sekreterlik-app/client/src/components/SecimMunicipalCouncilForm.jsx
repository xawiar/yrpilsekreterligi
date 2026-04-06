import React from 'react';

const SecimMunicipalCouncilForm = ({
  formData,
  municipalCouncilPartyInput,
  setMunicipalCouncilPartyInput,
  handleAddMunicipalCouncilParty,
  handleRemoveMunicipalCouncilParty,
  municipalCouncilCandidateInputs,
  setMunicipalCouncilCandidateInputs,
  handleAddMunicipalCouncilPartyCandidate,
  handleRemoveMunicipalCouncilPartyCandidate,
  handleInputChange,
}) => {
  return (
    <>
      {/* Belediye Meclis Partileri */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Belediye Meclis Partileri *
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={municipalCouncilPartyInput}
            onChange={(e) => setMunicipalCouncilPartyInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMunicipalCouncilParty();
              }
            }}
            placeholder="Parti adı girin ve Enter'a basın"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleAddMunicipalCouncilParty}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Parti Ekle
          </button>
        </div>
        {formData.municipal_council_parties && formData.municipal_council_parties.length > 0 && (
          <div className="space-y-3 mt-3">
            {formData.municipal_council_parties.map((party, index) => {
              const partyName = typeof party === 'string' ? party : party.name;
              const partyCandidates = typeof party === 'object' && party.candidates ? party.candidates : [];
              return (
                <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-yellow-800 dark:text-yellow-200">{partyName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMunicipalCouncilParty(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                    >
                      Partiyi Sil
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={municipalCouncilCandidateInputs[index] || ''}
                      onChange={(e) => setMunicipalCouncilCandidateInputs(prev => ({ ...prev, [index]: e.target.value }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddMunicipalCouncilPartyCandidate(index);
                        }
                      }}
                      placeholder="Bu parti için aday adı girin ve Enter'a basın"
                      className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddMunicipalCouncilPartyCandidate(index)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                    >
                      Aday Ekle
                    </button>
                  </div>
                  {partyCandidates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {partyCandidates.map((candidate, candidateIndex) => (
                        <span
                          key={candidateIndex}
                          className="inline-flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded text-xs"
                        >
                          {candidate}
                          <button
                            type="button"
                            onClick={() => handleRemoveMunicipalCouncilPartyCandidate(index, candidateIndex)}
                            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
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

      {/* Belediye Meclisi Toplam Üye Sayısı ve Nüfus (D'Hondt için) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Belediye Meclisi Toplam Üye Sayısı (D'Hondt Hesaplaması için) *
          </label>
          <input
            type="number"
            name="municipal_council_total_seats"
            value={formData.municipal_council_total_seats}
            onChange={handleInputChange}
            min="1"
            placeholder="Örn: 25"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Belediye meclisindeki toplam üye sayısı. D'Hondt hesaplaması için gereklidir.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Belediye Nüfusu (Kontenjan Hesaplaması için) *
          </label>
          <input
            type="number"
            name="population"
            value={formData.population}
            onChange={handleInputChange}
            min="0"
            placeholder="Örn: 120000"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Belediye nüfusu. Kontenjan sayısını belirlemek için gereklidir (10.000 altı: 1, 10.000-100.000: 2, 100.000 üstü: 3).
          </p>
        </div>
      </div>
    </>
  );
};

export default SecimMunicipalCouncilForm;
