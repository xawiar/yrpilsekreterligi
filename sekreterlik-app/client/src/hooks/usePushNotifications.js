import { useState, useEffect, useCallback } from 'react';
import ApiService from '../utils/ApiService';

export const usePushNotifications = (userId = null) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [vapidKey, setVapidKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Store userId globally for use in subscribe function
  if (userId && typeof window !== 'undefined') {
    window.userId = userId;
  }

  // Check if push notifications are supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      // Check existing subscription
      checkExistingSubscription();
    } else {
      setIsSupported(false);
      setError('Push notifications bu tarayıcıda desteklenmiyor');
    }
  }, []);

  // Check existing subscription
  const checkExistingSubscription = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        
        if (existingSubscription) {
          setSubscription(existingSubscription);
          setIsSubscribed(true);
          console.log('✅ Found existing push subscription');
        }
      }
    } catch (error) {
      console.warn('Error checking existing subscription:', error);
    }
  };

  // Get VAPID key function
  const getVapidKey = async () => {
    try {
      const response = await ApiService.getVapidKey();
      if (response && response.success && response.publicKey) {
        setVapidKey(response.publicKey);
        setError(null); // Clear any previous errors
        return response.publicKey;
      } else {
        console.warn('VAPID key response invalid:', response);
        setError('VAPID anahtarı alınamadı');
        return null;
      }
    } catch (error) {
      console.error('Error getting VAPID key:', error);
      setError('VAPID anahtarı alınırken hata oluştu: ' + error.message);
      return null;
    }
  };

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications bu tarayıcıda desteklenmiyor');
      return false;
    }

    let currentVapidKey = vapidKey;
    if (!currentVapidKey) {
      // VAPID key yoksa tekrar dene
      console.warn('VAPID key not available, retrying...');
      currentVapidKey = await getVapidKey();
      if (!currentVapidKey) {
        setError('VAPID anahtarı alınamadı. Lütfen sayfayı yenileyin.');
        return false;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Get existing subscription
      let existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        setSubscription(existingSubscription);
        setIsSubscribed(true);
        setIsLoading(false);
        console.log('✅ Already subscribed to push notifications');
        return true;
      }

      // Create new subscription
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(currentVapidKey)
      });

      // Send subscription to server
      // Get userId from auth context or pass as parameter
      const userId = window.userId || null; // Will be set by caller
      const response = await ApiService.subscribeToPush({
        userId,
        subscription: newSubscription
      });

      if (response && response.success) {
        setSubscription(newSubscription);
        setIsSubscribed(true);
        setError(null); // Clear any errors
        console.log('✅ Successfully subscribed to push notifications');
        return true;
      } else {
        throw new Error(response?.message || 'Subscription failed');
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setError(error.message || 'Bildirim aboneliği başarısız');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidKey]);

  // Get VAPID key on mount
  useEffect(() => {
    if (isSupported) {
      getVapidKey();
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Unsubscribe from browser
      await subscription.unsubscribe();

      // Notify server
      await ApiService.unsubscribeFromPush();

      setSubscription(null);
      setIsSubscribed(false);
      console.log('Successfully unsubscribed from push notifications');
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [subscription]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userId = window.userId || null;
      const response = await ApiService.sendTestNotification(userId);
      if (response.success) {
        console.log('Test notification sent successfully:', response.message);
        return true;
      } else {
        throw new Error(response.message || 'Test notification failed');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications desteklenmiyor');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        return true;
      } else {
        setError('Bildirim izni verilmedi');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setError(error.message);
      return false;
    }
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    subscription,
    vapidKey,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
    requestPermission
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
