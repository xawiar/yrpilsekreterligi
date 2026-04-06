import React from 'react';

const SecimMvForm = ({
  formData,
  partyInput,
  setPartyInput,
  handleAddParty,
  handleRemoveParty,
  mvCandidateInput,
  setMvCandidateInput,
  setSelectedPartyIndex,
  handleAddMvCandidate,
  handleRemoveMvCandidate,
  independentMvCandidateInput,
  setIndependentMvCandidateInput,
  handleAddIndependentMvCandidate,
  handleRemoveIndependentMvCandidate,
  handleInputChange,
}) => {
  return (
    <>
      {/* Partiler ve MV Adayları */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Partiler ve Milletvekili Adayları *
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={partyInput}
            onChange={(e) => setPartyInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddParty();
              }
            }}
            placeholder="Parti adı girin ve Enter'a basın"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleAddParty}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Parti Ekle
          </button>
        </div>

        {formData.parties.map((party, partyIndex) => (
          <div key={partyIndex} className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">{party.name}</h4>
              <button
                type="button"
                onClick={() => handleRemoveParty(partyIndex)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                Partiyi Sil
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={mvCandidateInput[partyIndex] || ''}
                onChange={(e) => setMvCandidateInput(prev => ({ ...prev, [partyIndex]: e.target.value }))}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMvCandidate(partyIndex);
                  }
                }}
                onFocus={() => setSelectedPartyIndex(partyIndex)}
                placeholder="MV adayı adı girin ve Enter'a basın"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => handleAddMvCandidate(partyIndex)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                MV Ekle
              </button>
            </div>
            {party.mv_candidates.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {party.mv_candidates.map((candidate, candidateIndex) => (
                  <span
                    key={candidateIndex}
                    className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm"
                  >
                    {candidate}
                    <button
                      type="button"
                      onClick={() => handleRemoveMvCandidate(partyIndex, candidateIndex)}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bağımsız MV Adayları */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Bağımsız Milletvekili Adayları
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={independentMvCandidateInput}
            onChange={(e) => setIndependentMvCandidateInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddIndependentMvCandidate();
              }
            }}
            placeholder="Bağımsız MV adayı adı girin ve Enter'a basın"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleAddIndependentMvCandidate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Ekle
          </button>
        </div>
        {formData.independent_mv_candidates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.independent_mv_candidates.map((candidate, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm"
              >
                {candidate}
                <button
                  type="button"
                  onClick={() => handleRemoveIndependentMvCandidate(index)}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* İldeki Toplam Milletvekili Sayısı (D'Hondt için) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          İldeki Toplam Milletvekili Sayısı (D'Hondt Hesaplaması için) *
        </label>
        <input
          type="number"
          name="mv_total_seats"
          value={formData.mv_total_seats}
          onChange={handleInputChange}
          min="1"
          placeholder="Örn: 10"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          required
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Bu il için seçilecek toplam milletvekili sayısı. D'Hondt hesaplaması için gereklidir.
        </p>
      </div>

      {/* Baraj Yüzdesi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Baraj Yüzdesi (%)
        </label>
        <input
          type="number"
          name="baraj_percent"
          value={formData.baraj_percent}
          onChange={handleInputChange}
          min="0"
          max="100"
          step="0.1"
          placeholder="7.0"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Seçim barajı yüzdesi (Türkiye için genellikle %7). İttifaklar ve partiler bu barajı geçmek zorundadır.
        </p>
      </div>
    </>
  );
};

export default SecimMvForm;
