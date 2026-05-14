import React from 'react';
import MemberFormOCRSettings from '../components/MemberFormOCRSettings';

// NOT: Permission kontrolü bu sayfaya EMBED eden parent'ta yapılır
// (MemberDashboardPage → hasViewPermission('member-form-ocr-page')).
// Standalone /member-form-ocr route'u PrivateRoute ile korunur.
const MemberFormOCRPage = () => {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Üye Formu OCR
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Elle doldurulmuş parti üye formlarını AI ile okutup Excel'e aktar
        </p>
      </div>
      <MemberFormOCRSettings />
    </div>
  );
};

export default MemberFormOCRPage;
