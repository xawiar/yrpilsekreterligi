import React from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';

const ExcelExport = ({ data, filename, buttonText, className = "" }) => {
  const toast = useToast();

  const exportToExcel = () => {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Convert data to worksheet
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Auto-calculate column widths from headers and data
      if (data && data.length > 0) {
        const keys = Object.keys(data[0]);
        worksheet['!cols'] = keys.map(key => {
          const maxDataLen = data.reduce((max, row) => {
            const val = row[key];
            const len = val != null ? String(val).length : 0;
            return Math.max(max, len);
          }, key.length);
          return { wch: Math.min(Math.max(maxDataLen + 2, 10), 40) };
        });
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      // Generate Excel file and download
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      
      // Show success message
      toast.success(`${filename} başarıyla Excel dosyası olarak indirildi!`);
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Excel dosyası oluşturulurken bir hata oluştu: ' + error.message);
    }
  };

  return (
    <button
      onClick={exportToExcel}
      className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {buttonText}
    </button>
  );
};

export default ExcelExport;
