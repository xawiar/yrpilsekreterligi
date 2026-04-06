import React from 'react';

const MemberUserPasswordResetModal = ({
  passwordResetUser,
  newPassword,
  setNewPassword,
  handlePasswordReset,
  setIsResettingPassword,
  setPasswordResetUser,
}) => {
  if (!passwordResetUser) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-modal">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Şifre Sıfırla — {passwordResetUser.displayName || passwordResetUser.name || passwordResetUser.username}
        </h3>
        <input
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Yeni şifre (min 6 karakter)"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white mb-4"
        />
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => { setIsResettingPassword(false); setPasswordResetUser(null); setNewPassword(''); }}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            İptal
          </button>
          <button
            onClick={() => handlePasswordReset()}
            disabled={newPassword.length < 6}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            Sıfırla
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberUserPasswordResetModal;
