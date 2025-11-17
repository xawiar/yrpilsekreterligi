import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import ElectionResultForm from '../components/ElectionResultForm';

const ElectionResultEditPage = () => {
  const { electionId, resultId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [result, setResult] = useState(null);
  const [ballotBox, setBallotBox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, [electionId, resultId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [electionsData, resultsData, ballotBoxesData] = await Promise.all([
        ApiService.getElections(),
        ApiService.getElectionResults(electionId, null),
        ApiService.getBallotBoxes()
      ]);

      const selectedElection = electionsData.find(e => String(e.id) === String(electionId));
      const selectedResult = resultsData.find(r => String(r.id) === String(resultId));
      const selectedBallotBox = ballotBoxesData.find(bb => String(bb.id) === String(selectedResult?.ballot_box_id));

      setElection(selectedElection);
      setResult(selectedResult);
      setBallotBox(selectedBallotBox);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    fetchData();
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!election || !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Seçim sonucu bulunamadı</h2>
          <button
            onClick={() => navigate(`/election-results/${electionId}`)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  const protocolPhoto = result.signed_protocol_photo || result.signedProtocolPhoto;
  const objectionPhoto = result.objection_protocol_photo || result.objectionProtocolPhoto;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Seçim Sonucu Düzenle - Sandık {result.ballot_number}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{election.name}</p>
            </div>
            <button
              onClick={() => navigate(`/election-results/${electionId}`)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              ← Geri Dön
            </button>
          </div>
        </div>

        {/* Main Content: Protocol on Left, Form on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Protocol Photos */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Seçim Tutanakları</h2>
            
            {protocolPhoto ? (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">İmzalı Tutanak</h3>
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <img
                    src={protocolPhoto}
                    alt="İmzalı Tutanak"
                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(protocolPhoto, '_blank')}
                  />
                </div>
              </div>
            ) : (
              <div className="mb-6 p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
                <p className="text-gray-500">İmzalı tutanak fotoğrafı yüklenmemiş</p>
              </div>
            )}

            {objectionPhoto && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">İtiraz Tutanağı</h3>
                <div className="border-2 border-red-200 rounded-lg overflow-hidden">
                  <img
                    src={objectionPhoto}
                    alt="İtiraz Tutanağı"
                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(objectionPhoto, '_blank')}
                  />
                </div>
              </div>
            )}

            {!protocolPhoto && !objectionPhoto && (
              <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
                <p className="text-gray-500">Henüz tutanak fotoğrafı yüklenmemiş</p>
              </div>
            )}
          </div>

          {/* Right: Form or Edit Button */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {!showForm ? (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Seçim Sonuç Verileri</h2>
                
                {/* Check if data exists */}
                {result.used_votes || result.valid_votes || result.invalid_votes ? (
                  <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Kullanılan Oy</label>
                        <div className="text-lg font-semibold text-gray-900">{result.used_votes || 0}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Geçersiz Oy</label>
                        <div className="text-lg font-semibold text-gray-900">{result.invalid_votes || 0}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Geçerli Oy</label>
                        <div className="text-lg font-semibold text-gray-900">{result.valid_votes || 0}</div>
                      </div>
                    </div>

                    {result.has_objection && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="text-sm font-semibold text-red-700 mb-1">İtiraz Edildi</div>
                        {result.objection_reason && (
                          <div className="text-sm text-red-600">{result.objection_reason}</div>
                        )}
                      </div>
                    )}

                    {result.notes && (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="text-sm font-semibold text-gray-700 mb-1">Notlar</div>
                        <div className="text-sm text-gray-600">{result.notes}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed border-yellow-300 rounded-lg text-center bg-yellow-50 mb-6">
                    <p className="text-yellow-800 font-medium">⚠️ Seçim sonuç verileri girilmemiş</p>
                    <p className="text-sm text-yellow-600 mt-2">Sadece tutanak fotoğrafı yüklenmiş</p>
                  </div>
                )}

                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  {result.used_votes || result.valid_votes || result.invalid_votes ? 'Sonuçları Düzenle' : 'Sonuçları Gir'}
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setShowForm(false)}
                  className="mb-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  ← Formu Kapat
                </button>
                <ElectionResultForm
                  election={election}
                  ballotBoxId={result.ballot_box_id}
                  ballotNumber={result.ballot_number}
                  onClose={() => setShowForm(false)}
                  onSuccess={handleSuccess}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectionResultEditPage;

