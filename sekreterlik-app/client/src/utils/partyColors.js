// Parti renkleri - Türkiye'deki yaygın partiler
export const PARTY_COLORS = {
  'AK Parti': { border: '#FF6B35', bg: '#FFF4F0', text: '#CC4A1F' },
  'Adalet ve Kalkınma Partisi': { border: '#FF6B35', bg: '#FFF4F0', text: '#CC4A1F' },
  'CHP': { border: '#DC143C', bg: '#FFF0F0', text: '#B01030' },
  'Cumhuriyet Halk Partisi': { border: '#DC143C', bg: '#FFF0F0', text: '#B01030' },
  'MHP': { border: '#FF8C00', bg: '#FFF8F0', text: '#CC7000' },
  'Milliyetçi Hareket Partisi': { border: '#FF8C00', bg: '#FFF8F0', text: '#CC7000' },
  'İYİ Parti': { border: '#1E90FF', bg: '#F0F8FF', text: '#0066CC' },
  'HDP': { border: '#9370DB', bg: '#F5F0FF', text: '#6A4C93' },
  'Halkların Demokratik Partisi': { border: '#9370DB', bg: '#F5F0FF', text: '#6A4C93' },
  'Saadet Partisi': { border: '#228B22', bg: '#F0FFF0', text: '#006400' },
  'Yeniden Refah Partisi': { border: '#FFD700', bg: '#FFFEF0', text: '#CCAA00' },
  'YRP': { border: '#FFD700', bg: '#FFFEF0', text: '#CCAA00' },
  'DEVA Partisi': { border: '#00CED1', bg: '#F0FFFF', text: '#008B8B' },
  'Gelecek Partisi': { border: '#FF1493', bg: '#FFF0F5', text: '#CC1166' },
  'Zafer Partisi': { border: '#000080', bg: '#F0F0FF', text: '#000066' },
};

// Parti ismine göre renk al (yoksa dinamik renk oluştur)
export const getPartyColor = (partyName) => {
  if (!partyName) return { border: '#E5E7EB', bg: '#F9FAFB', text: '#6B7280' };

  // Tam eşleşme kontrolü
  if (PARTY_COLORS[partyName]) {
    return PARTY_COLORS[partyName];
  }

  // Kısmi eşleşme kontrolü (büyük/küçük harf duyarsız)
  const normalizedName = partyName.toLowerCase();
  for (const [key, color] of Object.entries(PARTY_COLORS)) {
    if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
      return color;
    }
  }

  // Eşleşme yoksa, parti ismine göre dinamik renk oluştur
  let hash = 0;
  for (let i = 0; i < partyName.length; i++) {
    hash = partyName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Parlak renkler için HSL kullan
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 50 + (Math.abs(hash) % 10); // 50-60%

  // HSL'yi RGB'ye çevir (basit versiyon)
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
