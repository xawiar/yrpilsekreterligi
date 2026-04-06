import React from 'react';

const SecimMayorForm = ({
  formData,
  mayorPartyInput,
  setMayorPartyInput,
  handleAddMayorParty,
  handleRemoveMayorParty,
  mayorCandidateInputs,
  setMayorCandidateInputs,
  handleAddMayorPartyCandidate,
  handleRemoveMayorPartyCandidate,
  mayorCandidateInput,
  setMayorCandidateInput,
  handleAddMayorCandidate,
  handleRemoveMayorCandidate,
  title = 'Belediye Başkanı',
}) => {
  return (
    <>
      {/* Belediye Başkanı Partileri */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {title} Partileri *
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={mayorPartyInput}
            onChange={(e) => setMayorPartyInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMayorParty();
              }
            }}
            placeholder="Parti adı girin ve Enter'a basın"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleAddMayorParty}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Parti Ekle
          </button>
        </div>
        {formData.mayor_parties && formData.mayor_parties.length > 0 && (
          <div className="space-y-3 mt-3">
            {formData.mayor_parties.map((party, index) => {
              const partyName = typeof party === 'string' ? party : party.name;
              const partyCandidates = typeof party === 'object' && party.candidates ? party.candidates : [];
              return (
                <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-indigo-800 dark:text-indigo-200">{partyName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMayorParty(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                    >
                      Partiyi Sil
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={mayorCandidateInputs[index] || ''}
                      onChange={(e) => setMayorCandidateInputs(prev => ({ ...prev, [index]: e.target.value }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddMayorPartyCandidate(index);
                        }
                      }}
                      placeholder="Bu parti için aday adı girin ve Enter'a basın"
                      className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddMayorPartyCandidate(index)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                    >
                      Aday Ekle
                    </button>
                  </div>
                  {partyCandidates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {partyCandidates.map((candidate, candidateIndex) => (
                        <span
                          key={candidateIndex}
                          className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs"
                        >
                          {candidate}
                          <button
                            type="button"
                            onClick={() => handleRemoveMayorPartyCandidate(index, candidateIndex)}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
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

      {/* Bağımsız Belediye Başkanı Adayları */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Bağımsız {title} Adayları
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={mayorCandidateInput}
            onChange={(e) => setMayorCandidateInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMayorCandidate();
              }
            }}
            placeholder="Bağımsız aday adı girin ve Enter'a basın"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleAddMayorCandidate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Ekle
          </button>
        </div>
        {formData.mayor_candidates && formData.mayor_candidates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.mayor_candidates.map((candidate, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm"
              >
                {candidate}
                <button
                  type="button"
                  onClick={() => handleRemoveMayorCandidate(index)}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
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

export default SecimMayorForm;
