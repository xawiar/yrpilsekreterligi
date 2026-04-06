import React from 'react';

const MemberUserBulkActions = ({
  showCreateForm,
  setShowCreateForm,
  handleProcessAllUsers,
  handleDeleteAllMemberUsers,
  isProcessingAll,
  isUpdating,
  isDeletingAll,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Kullanıcı Yönetimi</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Üye ve başmüşahit kullanıcılarını görüntüleyebilirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
          >
            {showCreateForm ? 'İptal' : 'Yeni Üye Kullanıcısı Oluştur'}
          </button>
          <button
            onClick={handleProcessAllUsers}
            disabled={isProcessingAll || isUpdating}
            className="bg-gradient-to-r from-blue-600 via-green-600 to-purple-600 hover:from-blue-700 hover:via-green-700 hover:to-purple-700 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center shadow-lg"
            title="Tüm kullanıcıları oluştur: Üye + İlçe Başkanı + Belde Başkanı + Müşahit"
          >
            {isProcessingAll || isUpdating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Oluşturuluyor...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tüm Kullanıcıları Oluştur
              </>
            )}
          </button>
          <button
            onClick={handleDeleteAllMemberUsers}
            disabled={isDeletingAll}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
            title="DİKKAT: Üye kullanıcıları sayfasındaki TÜM kullanıcıları siler"
          >
            {isDeletingAll ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Siliniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Tüm Üye Kullanıcılarını Sil
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberUserBulkActions;
