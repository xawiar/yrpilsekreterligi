import React from 'react';

const ExcelImportButton = ({ onImport }) => {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Show import format instructions
      alert('Excel dosyası formatı:\n\n' +
            'A1: TC (11 haneli, zorunlu)\n' +
            'B1: İsim Soyisim (zorunlu)\n' +
            'C1: Telefon (zorunlu)\n' +
            'D1: Görev (opsiyonel, örn: İlçe Başkanı, Divan Üyesi)\n' +
            'E1: Bölge (opsiyonel, örn: Beşiktaş, Kadıköy)\n\n' +
            'Notlar:\n' +
            '- Görev veya bölge boş bırakılırsa otomatik olarak "Üye" olarak atanır.\n' +
            '- Yeni görev veya bölge adları otomatik olarak sisteme eklenir.\n' +
            '- Örnek: Görev kısmına "Divan" yazarsanız ve bu görev sistemde yoksa, otomatik olarak oluşturulur.\n' +
            '- Aynı şekilde bölge kısmına yeni bir bölge adı yazarsanız, otomatik olarak oluşturulur.\n\n' +
            'Devam etmek için "Tamam" tuşuna basın.');
      
      onImport(file);
      // Reset the file input
      e.target.value = null;
    }
  };

  return (
    <label className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
      Excel'den Yükle
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
      />
    </label>
  );
};

export default ExcelImportButton;