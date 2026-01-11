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

module.exports = mongoose.model('Voter', voterSchema);
