/**
 * KVKK uyumlu veri maskeleme yardımcıları
 * TC, telefon gibi hassas verileri maskeleyerek export güvenliğini sağlar
 */

export const maskTC = (tc) => tc ? `${String(tc).slice(0, 3)}****${String(tc).slice(-3)}` : '';

export const maskPhone = (phone) => phone ? `${String(phone).slice(0, 3)}****${String(phone).slice(-3)}` : '';

export const maskEmail = (email) => {
  if (!email) return '';
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
};
