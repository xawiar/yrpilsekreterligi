import React from 'react';

const SecimCbForm = ({
  formData,
  cbCandidateInput,
  setCbCandidateInput,
  handleAddCbCandidate,
  handleRemoveCbCandidate,
  independentCbCandidateInput,
  setIndependentCbCandidateInput,
  handleAddIndependentCbCandidate,
  handleRemoveIndependentCbCandidate,
}) => {
  return (
    <>
      {/* Cumhurbaşkanı Adayları */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Cumhurbaşkanı Adayları *
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={cbCandidateInput}
            onChange={(e) => setCbCandidateInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCbCandidate();
              }
            }}
            placeholder="CB adayı adı girin ve Enter'a basın"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleAddCbCandidate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Ekle
          </button>
        </div>
        {formData.cb_candidates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.cb_candidates.map((candidate, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-3 py-1 rounded-full text-sm"
              >
                {candidate}
                <button
                  type="button"
                  onClick={() => handleRemoveCbCandidate(index)}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bağımsız CB Adaylar�� */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Bağımsız Cumhurbaşkanı Adayları
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={independentCbCandidateInput}
            onChange={(e) => setIndependentCbCandidateInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddIndependentCbCandidate();
              }
            }}
            placeholder="Bağımsız CB adayı adı girin ve Enter'a basın"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleAddIndependentCbCandidate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Ekle
          </button>
        </div>
        {formData.independent_cb_candidates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.independent_cb_candidates.map((candidate, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm"
              >
                {candidate}
                <button
                  type="button"
                  onClick={() => handleRemoveIndependentCbCandidate(index)}
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

export default SecimCbForm;
