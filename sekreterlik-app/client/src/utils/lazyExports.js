/**
 * Excel ve PDF kütüphaneleri tıklamada (lazy) yüklensin.
 * Top-level import yerine handler içinde await loadXlsx() / await loadPdfMakers()
 * kullanılırsa kullanıcı "İndir" butonuna basana kadar bu paketler yüklenmez.
 *
 * Tasarruf: xlsx ~1.2 MB, jspdf ~150 KB, html2canvas ~200 KB
 * Toplam ~1.5 MB ana bundle dışında kalır.
 */

let _xlsxPromise = null;
let _pdfPromise = null;

/**
 * XLSX namespace'ini yükle. İlk çağrıda dinamik import yapar,
 * sonraki çağrılarda cached promise'i döner.
 */
export function loadXlsx() {
  if (!_xlsxPromise) {
    _xlsxPromise = import('xlsx').then((mod) => mod.default || mod);
  }
  return _xlsxPromise;
}

/**
 * jsPDF + html2canvas birlikte yükle (genelde birlikte kullanılır).
 * { jsPDF, html2canvas } objesi döner.
 */
export function loadPdfMakers() {
  if (!_pdfPromise) {
    _pdfPromise = Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]).then(([jspdf, h2c]) => ({
      jsPDF: jspdf.default || jspdf.jsPDF,
      html2canvas: h2c.default || h2c,
    }));
  }
  return _pdfPromise;
}
