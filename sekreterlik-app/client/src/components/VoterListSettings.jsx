import React from 'react';

const VoterListSettings = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Seçmen Listesi Yönetimi</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Seçmen listesi Excel dosyasını yükleyerek seçmen verilerini sisteme aktarabilirsiniz.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="max-w-xl">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Seçmen Listesi Excel Dosyası
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
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
                                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                    <label
                                        htmlFor="file-upload"
                                        className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                                    >
                                        <span>Dosya Yükle</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" />
                                    </label>
                                    <p className="pl-1">veya sürükleyip bırakın</p>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    XLS veya XLSX (Maks. 10MB)
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5">
                        <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            Yükle ve İşle
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoterListSettings;
