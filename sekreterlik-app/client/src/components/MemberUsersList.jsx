import React from 'react';
import { getMemberId, compareIds } from '../utils/normalizeId';

// Shared table row for password reset action
const PasswordResetButton = ({ user, setPasswordResetUser, setNewPassword, setIsResettingPassword }) => (
  <button
    onClick={() => { setPasswordResetUser(user); setNewPassword(''); setIsResettingPassword(true); }}
    className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
    title="Şifre Sıfırla"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  </button>
);

const StatusBadge = ({ user }) => (
  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
    user.is_active || user.isActive
      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
  }`}>
    {user.is_active || user.isActive ? 'Aktif' : 'Pasif'}
  </span>
);

const TableHeader = ({ columns }) => (
  <thead className="bg-gray-50 dark:bg-gray-700">
    <tr>
      {columns.map((col, idx) => (
        <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          {col}
        </th>
      ))}
    </tr>
  </thead>
);

// District Presidents Table
const DistrictPresidentsTable = ({ users, districts, searchTerm, setPasswordResetUser, setNewPassword, setIsResettingPassword }) => {
  if (users.length === 0) return null;

  const filtered = users.filter((user) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const district = districts.find(d => String(d.id) === String(user.districtId));
    const displayName = district?.name || user.chairmanName || 'Bilinmeyen';
    const username = (user.username || '').toLowerCase();
    return displayName.toLowerCase().includes(searchLower) || username.includes(searchLower);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        İlçe Başkanı Kullanıcılar�� ({users.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <TableHeader columns={['İlçe ve Başkan Bilgileri', 'Kullanıcı Adı', 'Şifre', 'Durum', 'İşlemler']} />
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((user) => {
              const district = districts.find(d => String(d.id) === String(user.districtId));
              const displayName = district?.name || user.chairmanName || 'Bilinmeyen İlçe';
              return (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.chairmanName || 'İlçe Başkanı'}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">İlçe Başkanı</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100">{user.username}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100 font-mono">••••••••</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge user={user} /></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <PasswordResetButton user={user} setPasswordResetUser={setPasswordResetUser} setNewPassword={setNewPassword} setIsResettingPassword={setIsResettingPassword} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Town Presidents Table
const TownPresidentsTable = ({ users, towns, searchTerm, setPasswordResetUser, setNewPassword, setIsResettingPassword }) => {
  if (users.length === 0) return null;

  const filtered = users.filter((user) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const town = towns.find(t => String(t.id) === String(user.townId));
    const displayName = town?.name || user.chairmanName || 'Bilinmeyen';
    const username = (user.username || '').toLowerCase();
    return displayName.toLowerCase().includes(searchLower) || username.includes(searchLower);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Belde Başkanı Kullanıcıları ({users.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <TableHeader columns={['Belde ve Başkan Bilgileri', 'Kullanıcı Adı', 'Şifre', 'Durum', 'İşlemler']} />
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((user) => {
              const town = towns.find(t => String(t.id) === String(user.townId));
              const displayName = town?.name || user.chairmanName || 'Bilinmeyen Belde';
              return (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.chairmanName || 'Belde Başkanı'}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">Belde Başkanı</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100">{user.username}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100 font-mono">••••••••</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge user={user} /></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <PasswordResetButton user={user} setPasswordResetUser={setPasswordResetUser} setNewPassword={setNewPassword} setIsResettingPassword={setIsResettingPassword} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Member Users Table
const MemberTypeUsersTable = ({ users, members, towns, districts, searchTerm, setPasswordResetUser, setNewPassword, setIsResettingPassword }) => {
  const filteredUsers = users.filter((user) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    let displayName = 'Bilinmeyen';
    let displayInfo = '-';

    if (user.userType === 'town_president' && user.townId) {
      const town = towns.find(t => String(t.id) === String(user.townId));
      displayName = town?.name || user.chairmanName || 'Bilinmeyen Belde';
      displayInfo = user.chairmanName || '';
    } else if (user.userType === 'district_president' && user.districtId) {
      displayName = user.chairmanName || 'Bilinmeyen İlçe';
      displayInfo = 'İlçe Başkanı';
    } else {
      const member = members.find(m => compareIds(m.id, getMemberId(user)));
      displayName = member?.name || 'Bilinmeyen Üye';
      const memberRegion = member?.region || member?.region_name || '-';
      const memberPosition = member?.position || member?.position_name || '-';
      displayInfo = `${memberRegion} - ${memberPosition}`;
    }

    const username = (user.username || '').toLowerCase();
    return displayName.toLowerCase().includes(searchLower) || username.includes(searchLower) || displayInfo.toLowerCase().includes(searchLower);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        Üye Kullanıcıları ({users.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <TableHeader columns={['Üye Bilgileri', 'Kullanıcı Adı', 'Şifre', 'Durum', 'İşlemler']} />
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz üye kullanıcısı bulunmuyor'}
                </td>
              </tr>
            ) : filteredUsers.map((user) => {
              let displayName = 'Bilinmeyen';
              let displayInfo = '-';
              let userTypeLabel = 'Üye';

              if (user.userType === 'town_president' && user.townId) {
                const town = towns.find(t => String(t.id) === String(user.townId));
                displayName = town?.name || user.chairmanName || 'Bilinmeyen Belde';
                displayInfo = user.chairmanName ? `${user.chairmanName} - Belde Başkanı` : 'Belde Başkanı';
                userTypeLabel = 'Belde Başkanı';
              } else if (user.userType === 'district_president' && user.districtId) {
                displayName = user.chairmanName || 'Bilinmeyen İlçe';
                displayInfo = 'İlçe Başkanı';
                userTypeLabel = 'İlçe Başkanı';
              } else {
                const member = members.find(m => compareIds(m.id, getMemberId(user)));
                displayName = member?.name || 'Bilinmeyen Üye';
                const memberRegion = member?.region || member?.region_name || '-';
                const memberPosition = member?.position || member?.position_name || '-';
                displayInfo = `${memberRegion} - ${memberPosition}`;
                userTypeLabel = 'Üye';
              }

              return (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{displayInfo}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-full ${
                          user.userType === 'town_president' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                            : user.userType === 'district_president' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {userTypeLabel}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100">{user.username}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100 font-mono">••••••••</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge user={user} /></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <PasswordResetButton user={user} setPasswordResetUser={setPasswordResetUser} setNewPassword={setNewPassword} setIsResettingPassword={setIsResettingPassword} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Observer Users Table
const ObserverUsersTable = ({ users, searchTerm, setPasswordResetUser, setNewPassword, setIsResettingPassword }) => {
  const filtered = users.filter((user) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (user.name || '').toLowerCase().includes(searchLower) || (user.username || '').toLowerCase().includes(searchLower);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Başmüşahit Kullanıcıları ({users.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <TableHeader columns={['Başmüşahit Bilgileri', 'Kullanıcı Adı (Sandık No)', 'Şifre (TC)', 'Durum', 'İşlemler']} />
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz başmüşahit kullanıcısı bulunmuyor'}
                </td>
              </tr>
            ) : filtered.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name || 'Bilinmeyen'}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">Başmüşahit</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100 font-mono">{user.username}</div></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100 font-mono">••••••••</div></td>
                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge user={user} /></td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <PasswordResetButton user={user} setPasswordResetUser={setPasswordResetUser} setNewPassword={setNewPassword} setIsResettingPassword={setIsResettingPassword} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Coordinator Users Table
const CoordinatorUsersTable = ({ users, searchTerm, setPasswordResetUser, setNewPassword, setIsResettingPassword }) => {
  const filtered = users.filter((user) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (user.name || '').toLowerCase().includes(searchLower) || (user.username || '').toLowerCase().includes(searchLower);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Sorumlu Kullanıcıları ({users.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <TableHeader columns={['Sorumlu Bilgileri', 'Kullanıcı Adı (TC)', 'Şifre (Telefon)', 'Durum', 'İşlemler']} />
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz sorumlu kullanıcısı bulunmuyor'}
                </td>
              </tr>
            ) : filtered.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name || 'Bilinmeyen'}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">Sorumlu</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100 font-mono">{user.username}</div></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 dark:text-gray-100 font-mono">••••••••</div></td>
                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge user={user} /></td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <PasswordResetButton user={user} setPasswordResetUser={setPasswordResetUser} setNewPassword={setNewPassword} setIsResettingPassword={setIsResettingPassword} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MemberUsersList = ({
  memberUsers,
  members,
  towns,
  districts,
  searchTerm,
  setPasswordResetUser,
  setNewPassword,
  setIsResettingPassword,
}) => {
  // Kullanıcıları tipine göre ayır
  const memberTypeUsers = memberUsers.filter(u =>
    !u.userType || u.userType === 'member' || (u.userType !== 'musahit' && u.userType !== 'district_president' && u.userType !== 'town_president' && u.userType !== 'coordinator')
  );
  const districtPresidentUsers = memberUsers.filter(u => u.userType === 'district_president');
  const townPresidentUsers = memberUsers.filter(u => u.userType === 'town_president');
  const observerTypeUsers = memberUsers.filter(u => u.userType === 'musahit');
  const coordinatorUsers = memberUsers.filter(u => u.userType === 'coordinator');

  const commonProps = { searchTerm, setPasswordResetUser, setNewPassword, setIsResettingPassword };

  return (
    <>
      <DistrictPresidentsTable users={districtPresidentUsers} districts={districts} {...commonProps} />
      <TownPresidentsTable users={townPresidentUsers} towns={towns} {...commonProps} />
      <MemberTypeUsersTable users={memberTypeUsers} members={members} towns={towns} districts={districts} {...commonProps} />
      <ObserverUsersTable users={observerTypeUsers} {...commonProps} />
      <CoordinatorUsersTable users={coordinatorUsers} {...commonProps} />
    </>
  );
};

export default MemberUsersList;
