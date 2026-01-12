const mongoose = require('mongoose');

const voterSchema = new mongoose.Schema({
    tc: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true // Metin araması için
    },
    phone: {
        type: String,
        trim: true,
        index: true
    },
    district: {
        type: String,
        trim: true
    },
    region: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        trim: true
    },
    ilce: { // Excel'deki 'İlçe' başlığı için alternatif
        type: String,
        trim: true
    },
    // ---- YENİ ALANLAR ----
    province: {
        type: String,
        trim: true,
        index: true
    },
    city: { // İl (Şehir)
        type: String,
        trim: true
    },
    village: { // Köy
        type: String,
        trim: true
    },
    neighborhood: { // Mahalle
        type: String,
        trim: true
    },
    birthDate: {
        type: String,
        trim: true
    },
    // ----------------------
    sourceFile: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Arama performansı için text index
voterSchema.index({ fullName: 'text', tc: 'text', phone: 'text' });

const Voter = mongoose.model('Voter', voterSchema);

// Init metodu - MongoDB bağlantısını kontrol eder
Voter.init = async () => {
  try {
    // MongoDB bağlantısı kontrolü
    if (mongoose.connection.readyState === 1) {
      console.log('✅ Voter model: MongoDB bağlantısı aktif');
      return Promise.resolve();
    } else {
      console.warn('⚠️ Voter model: MongoDB bağlantısı bekleniyor...');
      // Bağlantı kurulana kadar bekle (max 10 saniye)
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MongoDB bağlantısı zaman aşımına uğradı'));
        }, 10000);
        
        const checkConnection = () => {
          if (mongoose.connection.readyState === 1) {
            clearTimeout(timeout);
            console.log('✅ Voter model: MongoDB bağlantısı kuruldu');
            resolve();
          } else {
            setTimeout(checkConnection, 500);
          }
        };
        
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          console.log('✅ Voter model: MongoDB bağlantısı kuruldu (event)');
          resolve();
        });
        
        checkConnection();
      });
    }
  } catch (error) {
    console.error('❌ Voter model init hatası:', error);
    return Promise.reject(error);
  }
};

module.exports = Voter;
