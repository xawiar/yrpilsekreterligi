const mongoose = require('mongoose');

// MONGODB CONNECTION
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sekreterlik_messages';

const connectToMongoDB = async () => {
  try {
    // Mongoose connection options
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, options);
      console.log('✅ Mongoose: MongoDB bağlantısı başarılı!');
    } else {
      console.log('ℹ️ Mongoose: Zaten bağlı.');
    }

    return mongoose.connection;
  } catch (error) {
    console.error('❌ Mongoose bağlantı hatası:', error);
    // Retry logic or throw
    throw error;
  }
};

const closeConnection = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('MongoDB bağlantısı kapatıldı!');
  }
};

module.exports = {
  connectToMongoDB,
  closeConnection
};
