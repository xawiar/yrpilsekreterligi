/**
 * Photo Storage Utility
 * Handles photo uploads to Firebase Storage
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Uploads a member photo to Firebase Storage
 * @param {File} file - Photo file to upload
 * @param {number|string} memberId - Member ID
 * @returns {Promise<string>} Download URL of the uploaded photo
 */
export async function uploadMemberPhoto(file, memberId) {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `member-${memberId}-${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storageRef = ref(storage, `member-photos/${filename}`);

    // Upload file to Firebase Storage
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading photo to Firebase Storage:', error);
    throw new Error('Fotoğraf yüklenirken hata oluştu: ' + error.message);
  }
}

/**
 * Checks if a URL is a Firebase Storage URL
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is from Firebase Storage
 */
export function isFirebaseStorageUrl(url) {
  if (!url) return false;
  return url.includes('firebasestorage.googleapis.com') || 
         url.includes('firebasestorage.app');
}

