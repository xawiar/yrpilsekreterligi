import React from 'react';

const MemberUserForm = ({
  createForm,
  setCreateForm,
  handleCreateUser,
  handleMemberSelect,
  members,
  memberUsers,
  setShowCreateForm,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Yeni Kullanıcı Oluştur</h4>
      <form onSubmit={handleCreateUser} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Üye Seçin
          </label>
          <select
            value={createForm.memberId}
            onChange={(e) => {
              setCreateForm(prev => ({ ...prev, memberId: e.target.value }));
              handleMemberSelect(e.target.value);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
            required
          >
            <option value="">Üye seçin...</option>
            {members
              .filter(member => !memberUsers.some(user => user.member_id === member.id))
              .map(member => (
                <option key={member.id} value={member.id}>
                  {member.name} - {member.tc}
                </option>
              ))
            }
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Kullanıcı Adı (TC)
          </label>
          <input
            type="text"
            value={createForm.username}
            onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
            placeholder="TC kimlik numarası"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Şifre (Telefon)
          </label>
          <input
            type="text"
            value={createForm.password}
            onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
            placeholder="Telefon numarası (sadece rakamlar)"
            required
          />
        </div>

        <div className="flex space-x-2">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
          >
            Kullanıcı Oluştur
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
          >
            İptal
          </button>
        </div>
      </form>
    </div>
  );
};

export default MemberUserForm;
