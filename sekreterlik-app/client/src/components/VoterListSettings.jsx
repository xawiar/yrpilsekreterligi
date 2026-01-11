import React, { useState, useCallback } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';

const VoterListSettings = () => {
    const { showToast } = useToast();
    const [files, setFiles] = useState(null); // Tek dosya yerine files listesi
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Dosya seçme handler
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
            setUploadResult(null); // Önceki sonucu temizle
        }
    };

    // Dosya yükleme handler
    const handleUpload = async () => {
        if (!files || files.length === 0) {
            showToast('Lütfen en az bir dosya seçin', 'error');
            return;
        }

        setUploading(true);
        try {
            // ApiService artık FileList alıyor
            const result = await ApiService.uploadVoterList(files);
            setUploadResult(result);

            if (result.details && result.details.errors && result.details.errors.length > 0) {
                showToast(`${result.details.processedFiles.length} dosya işlendi, ${result.details.errors.length} dosyada hata var.`, 'warning');
            } else {
                showToast('Tüm dosyalar başarıyla yüklendi ve işlendi', 'success');
            }

            setFiles(null); // İşlem sonrası dosya seçimini temizle
            // Input değerini sıfırlamak için (re-renderda file input value tutmaz ama manuel temizlemek iyidir)
            document.getElementById('file-upload').value = "";

        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    // Arama fonksiyonu (Debounce)
    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const results = await ApiService.searchVoters(query);
            setSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Üst Bölüm: Yükleme */}
            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                        Seçmen Listesi Yükleme
                    </h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                        <p>Birden fazla Excel (.xlsx, .xls) veya CSV dosyasını aynı anda yükleyebilirsiniz.</p>
                        <p className="mt-1 text-xs">Gerekli Sütunlar: TC (Zorunlu), İsim Soyisim, Telefon, Bölge, İlçe, Görev</p>
                    </div>

                    <div className="mt-5">
                        <div className="flex items-center space-x-4">
                            <div className="w-full max-w-md">
                                <label
                                    htmlFor="file-upload"
                                    className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors cursor-pointer"
                                >
                                    <div className="space-y-1 text-center">
                                        <svg
                                            className="mx-auto h-12 w-12 text-gray-400"
                                            stroke="currentColor"
                                            fill="none"
                                            viewBox="0 0 48 48"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            <span className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                                                Dosyaları Seç
                                            </span>
                                            <input
                                                id="file-upload"
                                                name="file-upload"
                                                type="file"
                                                className="sr-only"
                                                accept=".xlsx, .xls, .csv"
                                                multiple
                                                onChange={handleFileChange}
                                            />
                                            <span className="pl-1">veya sürükle bırak</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {files && files.length > 0 ? `${files.length} dosya seçildi` : "XLSX, XLS veya CSV (Çoklu seçim)"}
                                        </p>
                                    </div>
                                </label>
                            </div>

                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={!files || uploading}
                                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${(!files || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {uploading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        İşleniyor...
                                    </>
                                ) : 'Yükle ve İşle'}
                            </button>
                        </div>

                        {uploadResult && (
                            <div className="mt-4">
                                {uploadResult.stats && (
                                    <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                                        <div className="flex">
                                            <div className="ml-3">
                                                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                                                    İşlem Özeti
                                                </h3>
                                                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                                                    <p>Toplam Kayıt: {uploadResult.stats.totalProcessed}</p>
                                                    <p>Yeni Eklenen: {uploadResult.stats.upsertedCount}</p>
                                                    <p>Güncellenen: {uploadResult.stats.modifiedCount}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {uploadResult.details && uploadResult.details.errors && uploadResult.details.errors.length > 0 && (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-md border border-red-200 dark:border-red-800">
                                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                                            Hatalar / Uyarılar
                                        </h3>
                                        <ul className="list-disc pl-5 text-sm text-red-700 dark:text-red-300 space-y-1">
                                            {uploadResult.details.errors.map((err, idx) => (
                                                <li key={idx}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Alt Bölüm: Arama */}
            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                        Seçmen Sorgulama
                    </h3>

                    <div className="max-w-xl">
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Arama
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                name="search"
                                id="search"
                                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md py-2"
                                placeholder="TC, İsim Soyisim veya Telefon (En az 2 karakter)"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                            {searching && (
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sonuç Listesi */}
                    <div className="mt-6">
                        {searchResults.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">TC Kimlik</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ad Soyad</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Telefon</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">İlçe / Bölge</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Görev</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {searchResults.map((voter) => (
                                            <tr key={voter._id || voter.tc} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {voter.tc}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {voter.fullName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {voter.phone}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {voter.district} {voter.region && `(Bölge ${voter.region})`}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                        {voter.role}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            searchQuery.length >= 2 && !searching && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Sonuç bulunamadı.</p>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoterListSettings;
