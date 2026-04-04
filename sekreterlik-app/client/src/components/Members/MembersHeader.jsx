import React from 'react';
import { useNavigate } from 'react-router-dom';

const MembersHeader = ({ onAddMember }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Uyeler</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Yonetim kurulu uyelerini yonetin</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => navigate('/archive')}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center shadow-sm hover:shadow-md"
          title="Arsivlenmis uyeleri goruntule"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Arsiv
        </button>
        <button
          onClick={onAddMember}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Uye Ekle
        </button>
      </div>
    </div>
  );
};

export default MembersHeader;