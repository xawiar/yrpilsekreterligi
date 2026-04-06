import React from 'react';

const SecimIttifakYonetimi = ({
  editingElection,
  alliances,
  showAllianceForm,
  setShowAllianceForm,
  allianceNameInput,
  setAllianceNameInput,
  selectedAllianceParties,
  setSelectedAllianceParties,
  setEditingAlliance,
  formData,
  handleCreateAlliance,
  handleDeleteAlliance,
  togglePartyForAlliance,
}) => {
  if (!editingElection || !editingElection.id) return null;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          İttifak Yönetimi
        </h3>
        <button
          type="button"
          onClick={() => {
            setShowAllianceForm(!showAllianceForm);
            setAllianceNameInput('');
            setSelectedAllianceParties([]);
            setEditingAlliance(null);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showAllianceForm ? 'İptal' : '+ Yeni İttifak'}
        </button>
      </div>

      {/* Mevcut İttifaklar */}
      {alliances.length > 0 && (
        <div className="space-y-3 mb-4">
          {alliances.map((alliance) => (
            <div
              key={alliance.id}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {alliance.name}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(alliance.party_ids || []).map((partyId, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded text-sm"
                      >
                        {typeof partyId === 'string' ? partyId : (partyId.name || String(partyId))}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAlliance(alliance.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* İttifak Oluşturma Formu */}
      {showAllianceForm && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Yeni İttifak Oluştur
          </h4>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              İttifak Adı *
            </label>
            <input
              type="text"
              value={allianceNameInput}
              onChange={(e) => setAllianceNameInput(e.target.value)}
              placeholder="Örn: Cumhur İttifakı"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Partileri Seçin (En az 2 parti) *
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800">
              {formData.parties.length > 0 ? (
                formData.parties.map((party, idx) => {
                  const partyName = typeof party === 'string' ? party : (party.name || String(party));
                  const isSelected = selectedAllianceParties.some(p => {
                    const pName = typeof p === 'string' ? p : (p.name || String(p));
                    return pName === partyName;
                  });

                  // Bu parti zaten başka bir ittifakta mı?
                  const isInOtherAlliance = alliances.some(a => {
                    const partyIds = a.party_ids || [];
                    return partyIds.some(pid => {
                      const pidName = typeof pid === 'string' ? pid : (pid.name || String(pid));
                      return pidName === partyName;
                    });
                  });

                  return (
                    <label
                      key={idx}
                      className={`flex items-center p-2 rounded cursor-pointer mb-1 ${
                        isSelected
                          ? 'bg-indigo-100 dark:bg-indigo-900'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      } ${isInOtherAlliance ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePartyForAlliance(party)}
                        disabled={isInOtherAlliance}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {partyName}
                        {isInOtherAlliance && (
                          <span className="ml-2 text-xs text-gray-500">(Başka ittifakta)</span>
                        )}
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Önce parti ekleyin
                </p>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Seçili: {selectedAllianceParties.length} parti
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateAlliance}
            disabled={!allianceNameInput.trim() || selectedAllianceParties.length < 2}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            İttifak Oluştur
          </button>
        </div>
      )}
    </div>
  );
};

export default SecimIttifakYonetimi;
