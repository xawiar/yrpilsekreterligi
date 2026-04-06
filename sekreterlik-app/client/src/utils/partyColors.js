// Parti renkleri - Turkiye'deki yaygin partiler
// Her parti icin border (grafik/badge rengi), bg (arka plan), text (yazi rengi)
export const PARTY_COLORS = {
  'YRP': { border: '#00843D', bg: '#F0FFF4', text: '#006430' },
  'Yeniden Refah Partisi': { border: '#00843D', bg: '#F0FFF4', text: '#006430' },
  'AK Parti': { border: '#FFA500', bg: '#FFF8F0', text: '#CC8400' },
  'AK PARTI': { border: '#FFA500', bg: '#FFF8F0', text: '#CC8400' },
  'Adalet ve Kalkinma Partisi': { border: '#FFA500', bg: '#FFF8F0', text: '#CC8400' },
  'CHP': { border: '#ED1C24', bg: '#FFF0F0', text: '#B01030' },
  'Cumhuriyet Halk Partisi': { border: '#ED1C24', bg: '#FFF0F0', text: '#B01030' },
  'MHP': { border: '#CC0000', bg: '#FFF0F0', text: '#990000' },
  'Milliyetci Hareket Partisi': { border: '#CC0000', bg: '#FFF0F0', text: '#990000' },
  'IYI Parti': { border: '#0066B3', bg: '#F0F8FF', text: '#004C8A' },
  'IYI PARTI': { border: '#0066B3', bg: '#F0F8FF', text: '#004C8A' },
  'HDP': { border: '#8B00FF', bg: '#F5F0FF', text: '#6A00CC' },
  'Halklarin Demokratik Partisi': { border: '#8B00FF', bg: '#F5F0FF', text: '#6A00CC' },
  'DEM': { border: '#8B00FF', bg: '#F5F0FF', text: '#6A00CC' },
  'DEM Parti': { border: '#8B00FF', bg: '#F5F0FF', text: '#6A00CC' },
  'DEVA': { border: '#00A0E3', bg: '#F0FAFF', text: '#007AB8' },
  'DEVA Partisi': { border: '#00A0E3', bg: '#F0FAFF', text: '#007AB8' },
  'GP': { border: '#006400', bg: '#F0FFF0', text: '#004D00' },
  'Gelecek Partisi': { border: '#FF1493', bg: '#FFF0F5', text: '#CC1166' },
  'SP': { border: '#D4001E', bg: '#FFF0F2', text: '#A80018' },
  'Saadet Partisi': { border: '#D4001E', bg: '#FFF0F2', text: '#A80018' },
  'BBP': { border: '#C41E3A', bg: '#FFF0F3', text: '#9C1830' },
  'Buyuk Birlik Partisi': { border: '#C41E3A', bg: '#FFF0F3', text: '#9C1830' },
  'TIP': { border: '#FF0000', bg: '#FFF0F0', text: '#CC0000' },
  'Turkiye Isci Partisi': { border: '#FF0000', bg: '#FFF0F0', text: '#CC0000' },
  'ZP': { border: '#000080', bg: '#F0F0FF', text: '#000066' },
  'Zafer Partisi': { border: '#000080', bg: '#F0F0FF', text: '#000066' },
  'BAGIMSIZ': { border: '#808080', bg: '#F5F5F5', text: '#555555' },
  'Bagimsiz': { border: '#808080', bg: '#F5F5F5', text: '#555555' },
};

// Grafik/chart icin tek renk mapping (pie chart, bar chart, vb.)
export const PARTY_CHART_COLORS = {
  'YRP': '#00843D',
  'Yeniden Refah Partisi': '#00843D',
  'AK Parti': '#FFA500',
  'AK PARTI': '#FFA500',
  'Adalet ve Kalkinma Partisi': '#FFA500',
  'CHP': '#ED1C24',
  'Cumhuriyet Halk Partisi': '#ED1C24',
  'MHP': '#CC0000',
  'Milliyetci Hareket Partisi': '#CC0000',
  'IYI Parti': '#0066B3',
  'IYI PARTI': '#0066B3',
  'HDP': '#8B00FF',
  'DEM': '#8B00FF',
  'DEM Parti': '#8B00FF',
  'DEVA': '#00A0E3',
  'DEVA Partisi': '#00A0E3',
  'GP': '#006400',
  'Gelecek Partisi': '#FF1493',
  'SP': '#D4001E',
  'Saadet Partisi': '#D4001E',
  'BBP': '#C41E3A',
  'TIP': '#FF0000',
  'ZP': '#000080',
  'Zafer Partisi': '#000080',
  'BAGIMSIZ': '#808080',
  'Bagimsiz': '#808080',
};

// Fallback grafik renkleri (eslesme bulunamadiginda sirayla kullanilir)
const FALLBACK_CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#A4DE6C', '#D0ED57',
  '#FAD000', '#F66D44', '#FEAE65', '#E6F69D', '#AADEA7',
  '#64C2A6', '#2D87BB', '#7E57C2', '#FF7043', '#26A69A'
];

/**
 * Parti ismine gore grafik rengi dondur
 * @param {string} partyName - Parti ismi
 * @param {number} index - Fallback icin sira numarasi
 * @returns {string} Hex renk kodu
 */
export const getPartyChartColor = (partyName, index = 0) => {
  if (!partyName) return FALLBACK_CHART_COLORS[index % FALLBACK_CHART_COLORS.length];

  // Tam eslestirme
  if (PARTY_CHART_COLORS[partyName]) return PARTY_CHART_COLORS[partyName];

  // Kismi eslestirme (buyuk/kucuk harf duyarsiz)
  const normalizedName = partyName.toLowerCase();
  for (const [key, color] of Object.entries(PARTY_CHART_COLORS)) {
    if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
      return color;
    }
  }

  // Eslestirme yoksa fallback renklerinden sec
  return FALLBACK_CHART_COLORS[index % FALLBACK_CHART_COLORS.length];
};

// Parti ismine gore renk al (yoksa dinamik renk olustur)
export const getPartyColor = (partyName) => {
  if (!partyName) return { border: '#E5E7EB', bg: '#F9FAFB', text: '#6B7280' };

  // Tam eslestirme kontrolu
  if (PARTY_COLORS[partyName]) {
    return PARTY_COLORS[partyName];
  }

  // Kismi eslestirme kontrolu (buyuk/kucuk harf duyarsiz)
  const normalizedName = partyName.toLowerCase();
  for (const [key, color] of Object.entries(PARTY_COLORS)) {
    if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
      return color;
    }
  }

  // Eslestirme yoksa, parti ismine gore dinamik renk olustur
  let hash = 0;
  for (let i = 0; i < partyName.length; i++) {
    hash = partyName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Parlak renkler icin HSL kullan
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 50 + (Math.abs(hash) % 10); // 50-60%

  // HSL'yi RGB'ye cevir (basit versiyon)
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 1/6) { r = c; g = x; b = 0; }
  else if (h < 2/6) { r = x; g = c; b = 0; }
  else if (h < 3/6) { r = 0; g = c; b = x; }
  else if (h < 4/6) { r = 0; g = x; b = c; }
  else if (h < 5/6) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  const borderColor = `rgb(${r}, ${g}, ${b})`;
  const bgColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
  const textColor = `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)})`;

  return { border: borderColor, bg: bgColor, text: textColor };
};
