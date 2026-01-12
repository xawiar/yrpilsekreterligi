import React, { useState, useCallback } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';
import * as XLSX from 'xlsx';

const VoterListSettings = () => {
    const { showToast } = useToast();
    const [files, setFiles] = useState(null); // Tek dosya yerine files listesi
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Preview State
    const [previewData, setPreviewData] = useState([]);
    const [previewColumns, setPreviewColumns] = useState([]);
    const [previewFileName, setPreviewFileName] = useState('');

    // Dosya seçme handler
    const handleFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = e.target.files;
            setFiles(selectedFiles);
            setUploadResult(null); // Önceki sonucu temizle

            // PREVIEW İÇİN İLK DOSYAYI OKU
            try {
                const firstFile = selectedFiles[0];
                setPreviewFileName(firstFile.name);

                const reader = new FileReader();
                reader.onload = (evt) => {
                    const bstr = evt.target.result;
                    let workbook;

                    // CSV Encoding kontrolü için basit mantık
                    if (firstFile.name.toLowerCase().endsWith('.csv')) {
                        workbook = XLSX.read(bstr, { type: 'binary', codepage: 65001 }); // UTF-8 dene
                    } else {
                        workbook = XLSX.read(bstr, { type: 'binary' });
                    }

                    const wsname = workbook.SheetNames[0];
                    const ws = workbook.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }); // Array of arrays

                    if (data && data.length > 0) {
                        const headers = data[0];
                        const rows = data.slice(1, 21); // İlk 20 satır (Header hariç)

                        setPreviewColumns(headers);
                        setPreviewData(rows);
                    }
                };
                reader.readAsBinaryString(firstFile);

            } catch (err) {
                console.error("Preview error:", err);
            }
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
            setPreviewData([]); // Upload başarılıysa preview'i temizle

            if (result.globalStats && result.globalStats.skippedRows > 0) {
                showToast(`İşlem tamamlandı ancak ${result.globalStats.skippedRows} kayıt atlandı/hatalı.`, 'warning');
            } else {
                showToast('Tüm dosyalar başarıyla yüklendi ve işlendi', 'success');
            }

            setFiles(null); // İşlem sonrası dosya seçimini temizle
            // Input değerini sıfırlamak için
            const fileInput = document.getElementById('file-upload');
            if (fileInput) fileInput.value = "";

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

                        {/* PREVIEW SECTION */}
                        {previewData.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2">
                                    Dosya Önizlemesi (İlk 20 Satır) - {previewFileName}
                                </h4>
                                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                                            <tr>
                                                {previewColumns.map((col, idx) => (
                                                    <th key={idx} scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {previewData.map((row, rIdx) => (
                                                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/30'}>
                                                    {previewColumns.map((col, cIdx) => (
                                                        <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">
                                                            {row[cIdx] || ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    * Bu sadece önizlemedir. Yükle butonuna basana kadar veriler kaydedilmez.
                                </p>
                            </div>
                        )}

                        {/* DETAYLI RAPORLAMA UI */}
                        {uploadResult && (
                            <div className="mt-6 space-y-4">
                                {uploadResult.globalStats && (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2">
                                            Genel Özet
                                        </h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-500 dark:text-gray-400">İşlenen Kayıt</span>
                                                <span className="font-semibold text-gray-900 dark:text-white">{uploadResult.globalStats.totalProcessed}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-green-600 dark:text-green-400">Yeni Eklenen</span>
                                                <span className="font-semibold text-green-700 dark:text-green-300">{uploadResult.globalStats.upsertedCount}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-blue-600 dark:text-blue-400">Güncellenen</span>
                                                <span className="font-semibold text-blue-700 dark:text-blue-300">{uploadResult.globalStats.modifiedCount}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-red-600 dark:text-red-400">Atlanan/Hatalı</span>
                                                <span className="font-semibold text-red-700 dark:text-red-300">{uploadResult.globalStats.skippedRows}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {uploadResult.fileReports && uploadResult.fileReports.map((report, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-md border text-sm ${report.status === 'success'
                                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                            : report.status === 'warning'
                                                ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                                                : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <h5 className="font-bold text-gray-900 dark:text-gray-100">{report.fileName}</h5>
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${report.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                                                report.status === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                                                    'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                                                }`}>
                                                {report.status === 'success' ? 'Başarılı' : report.status === 'warning' ? 'Uyarı' : 'Hata'}
                                            </span>
                                        </div>

                                        <p className="mt-1 font-medium">{report.message}</p>

                                        <div className="mt-2 text-xs space-y-1 opacity-90">
                                            <div>Toplam Satır: {report.totalRows} | Geçerli: {report.validRows}</div>

                                            {report.detectedColumns && Object.keys(report.detectedColumns).length > 0 ? (
                                                <div className="mt-1 p-2 bg-white/50 dark:bg-black/20 rounded">
                                                    <strong>Bulunan Sütunlar:</strong> {Object.entries(report.detectedColumns).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                                </div>
                                            ) : (
                                                <div className="mt-1 text-red-600 dark:text-red-400 font-bold">
                                                    Sütun başlıkları eşleştirilemedi! Lütfen 'TC' başlığının olduğundan emin olun.
                                                </div>
                                            )}

                                            {report.sampleIgnoredReason && (
                                                <div className="mt-2 p-2 bg-red-100/50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
                                                    <strong>Örnek Hata:</strong> {report.sampleIgnoredReason}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
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
