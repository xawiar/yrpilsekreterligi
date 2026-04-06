import React from 'react';
import SecimIttifakYonetimi from './SecimIttifakYonetimi';
import SecimCbForm from './SecimCbForm';
import SecimMvForm from './SecimMvForm';
import SecimMayorForm from './SecimMayorForm';
import SecimProvincialAssemblyForm from './SecimProvincialAssemblyForm';
import SecimMunicipalCouncilForm from './SecimMunicipalCouncilForm';

const SecimElectionForm = ({
  formData,
  handleInputChange,
  handleSubmit,
  editingElection,
  getStatusLabel,
  getAllowedStatusOptions,
  // CB handlers
  cbCandidateInput,
  setCbCandidateInput,
  handleAddCbCandidate,
  handleRemoveCbCandidate,
  independentCbCandidateInput,
  setIndependentCbCandidateInput,
  handleAddIndependentCbCandidate,
  handleRemoveIndependentCbCandidate,
  // MV handlers
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
  // Mayor handlers
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
  // Provincial Assembly handlers
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
  // Municipal Council handlers
  municipalCouncilPartyInput,
  setMunicipalCouncilPartyInput,
  handleAddMunicipalCouncilParty,
  handleRemoveMunicipalCouncilParty,
  municipalCouncilCandidateInputs,
  setMunicipalCouncilCandidateInputs,
  handleAddMunicipalCouncilPartyCandidate,
  handleRemoveMunicipalCouncilPartyCandidate,
  // Alliance props
  alliances,
  showAllianceForm,
  setShowAllianceForm,
  allianceNameInput,
  setAllianceNameInput,
  selectedAllianceParties,
  setSelectedAllianceParties,
  setEditingAlliance,
  handleCreateAlliance,
  handleDeleteAlliance,
  togglePartyForAlliance,
  // Form actions
  setShowForm,
  setEditingElection,
  resetForm,
}) => {
  const cbFormProps = {
    formData,
    cbCandidateInput,
    setCbCandidateInput,
    handleAddCbCandidate,
    handleRemoveCbCandidate,
    independentCbCandidateInput,
    setIndependentCbCandidateInput,
    handleAddIndependentCbCandidate,
    handleRemoveIndependentCbCandidate,
  };

  const mvFormProps = {
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
  };

  const mayorFormProps = {
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
  };

  const provincialAssemblyFormProps = {
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
  };

  const municipalCouncilFormProps = {
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
  };

  const allianceProps = {
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
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Seçim Adı *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Seçim Tarihi *
        </label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Seçim Tipi *
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            required
          >
            <optgroup label="Genel Seçimler">
              <option value="cb">Cumhurbaşkanı Seçimi</option>
              <option value="mv">Milletvekili Genel Seçimi</option>
              <option value="genel">Genel Seçim (CB + MV Birlikte)</option>
            </optgroup>
            <optgroup label="Yerel Seçimler">
              <option value="yerel_metropolitan_mayor">Büyükşehir Belediye Başkanı</option>
              <option value="yerel_city_mayor">İl Belediye Başkanı</option>
              <option value="yerel_district_mayor">İlçe Belediye Başkanı</option>
              <option value="yerel_provincial_assembly">İl Genel Meclisi Üyesi</option>
              <option value="yerel_municipal_council">Belediye Meclisi Üyesi</option>
              <option value="yerel">Yerel Seçim (Tüm Alt Türler - Eski Sistem)</option>
            </optgroup>
            <optgroup label="Diğer">
              <option value="referandum">Referandum</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Durum *
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            required
          >
            {(editingElection
              ? getAllowedStatusOptions(editingElection.status || 'draft')
              : ['draft', 'active', 'closed']
            ).map(s => (
              <option key={s} value={s}>{getStatusLabel(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cumhurbaşkanı Seçimi Formu */}
      {formData.type === 'cb' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cumhurbaşkanı Seçimi Bilgileri</h3>
          <SecimCbForm {...cbFormProps} />
        </div>
      )}

      {/* Milletvekili Genel Seçimi Formu */}
      {formData.type === 'mv' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Milletvekili Genel Seçimi Bilgileri</h3>
          <SecimMvForm {...mvFormProps} />
        </div>
      )}

      {/* Genel Seçim Formu (CB + MV Birlikte) */}
      {formData.type === 'genel' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Genel Seçim Bilgileri</h3>
          <SecimCbForm {...cbFormProps} />
          <SecimMvForm {...mvFormProps} />
          <SecimIttifakYonetimi {...allianceProps} />
        </div>
      )}

      {/* Büyükşehir Belediye Başkanı Formu */}
      {formData.type === 'yerel_metropolitan_mayor' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Büyükşehir Belediye Başkanı Seçimi Bilgileri</h3>
          <SecimMayorForm {...mayorFormProps} title="Büyükşehir Belediye Başkanı" />
        </div>
      )}

      {/* İl Belediye Başkanı Formu */}
      {formData.type === 'yerel_city_mayor' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">İl Belediye Başkanı Seçimi Bilgileri</h3>
          <SecimMayorForm {...mayorFormProps} title="İl Belediye Başkanı" />
        </div>
      )}

      {/* İlçe Belediye Başkanı Formu */}
      {formData.type === 'yerel_district_mayor' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">İlçe Belediye Başkanı Seçimi Bilgileri</h3>
          <SecimMayorForm {...mayorFormProps} title="İlçe Belediye Başkanı" />
        </div>
      )}

      {/* İl Genel Meclisi Üyesi Formu */}
      {formData.type === 'yerel_provincial_assembly' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">İl Genel Meclisi Üyesi Seçimi Bilgileri</h3>
          <SecimProvincialAssemblyForm {...provincialAssemblyFormProps} />
        </div>
      )}

      {/* Belediye Meclisi Üyesi Formu */}
      {formData.type === 'yerel_municipal_council' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Belediye Meclisi Üyesi Seçimi Bilgileri</h3>
          <SecimMunicipalCouncilForm {...municipalCouncilFormProps} />
        </div>
      )}

      {/* Yerel Seçim Formu (Tüm Alt Türler - Eski Sistem Uyumluluğu) */}
      {formData.type === 'yerel' && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yerel Seçim Bilgileri</h3>
          <SecimMayorForm {...mayorFormProps} title="Belediye Başkanı" />
          <SecimProvincialAssemblyForm {...provincialAssemblyFormProps} />
          <SecimMunicipalCouncilForm {...municipalCouncilFormProps} />
        </div>
      )}

      {/* Referandum Formu */}
      {formData.type === 'referandum' && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Referandum Bilgileri</h3>
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Referandum için otomatik olarak "Evet" ve "Hayır" seçenekleri oluşturulacaktır.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {editingElection ? 'Güncelle' : 'Kaydet'}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setEditingElection(null);
            resetForm();
          }}
          className="bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          İptal
        </button>
      </div>
    </form>
  );
};

export default SecimElectionForm;
