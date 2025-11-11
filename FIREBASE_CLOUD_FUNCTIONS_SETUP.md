# 🔔 Firebase Cloud Functions - Push Notification Kurulum Kılavuzu

## 📋 Özet

Firebase Cloud Functions ile gerçek push notification gönderebilmek için adım adım kurulum kılavuzu.

---

## ✅ Seçenek 3 (In-App Notification) Hakkında

**Soru:** Uygulama ekranda açık değilken uyarı geliyor mu?

**Cevap:** ❌ **HAYIR**
- In-app notification'lar sadece site açıkken çalışır
- Site kapalıyken bildirim gelmez
- Push notification ise site kapalıyken bile çalışır (telefonun üstünde WhatsApp gibi görünür)

---

## 🚀 Firebase Cloud Functions Kurulumu

### ADIM 1: Firebase CLI Kurulumu

```bash
# Firebase CLI'yi global olarak yükle
npm install -g firebase-tools

# Firebase'e giriş yap
firebase login

# Projeyi başlat (functions klasörü oluşturur)
firebase init functions
```

**Seçimler:**
- ✅ Functions: Configure a Cloud Functions directory
- ✅ JavaScript (veya TypeScript)
- ✅ ESLint: Evet
- ✅ Install dependencies: Evet

---

### ADIM 2: Functions Klasörü Yapısı

Kurulum sonrası şu klasör yapısı oluşur:

```
sekreterlik-app/
├── functions/
│   ├── index.js
│   ├── package.json
│   └── node_modules/
└── firebase.json
```

---

### ADIM 3: Dependencies Yükleme

```bash
cd sekreterlik-app/functions

# web-push kütüphanesini yükle
npm install web-push

# Firebase Admin SDK zaten yüklü (init sırasında)
```

---

### ADIM 4: Cloud Function Kodu

`sekreterlik-app/functions/index.js` dosyasını şu şekilde güncelleyin:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');

// Firebase Admin SDK'yı başlat
admin.initializeApp();

// VAPID keys (server/services/pushNotificationService.js'den alın)
const vapidKeys = {
  publicKey: 'BO9vjwvHvLDxeP-H2IY92hsQlWGYTCW7NpX3M0GAyooyTbT30Y_0q_ahIsomr38bsL2Nbh7DHEZKMD7YTsiEYf8',
  privateKey: 'qeBR6H6KXMWnJWdva1oXIRlWfYB04p4CnM-oAXVQWzA'
};

// web-push yapılandırması
webpush.setVapidDetails(
  'mailto:admin@sekreterlik.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/**
 * Push notification gönder
 * Firestore'da push_subscriptions collection'ından subscription'ları alır ve gönderir
 */
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  try {
    const { title, body, icon, badge, data: notificationData, badgeCount } = data;

    // Firestore'dan tüm subscription'ları al
    const subscriptionsSnapshot = await admin.firestore()
      .collection('push_subscriptions')
      .get();

    if (subscriptionsSnapshot.empty) {
      return { success: false, message: 'Aktif subscription bulunamadı' };
    }

    // Payload oluştur
    const payload = {
      title: title || 'Bildirim',
      body: body || 'Yeni bildirim',
      icon: icon || '/icon-192x192.png',
      badge: badgeCount ? badgeCount.toString() : (badge || '/badge-72x72.png'),
      data: {
        ...notificationData,
        timestamp: new Date().toISOString(),
        badgeCount: badgeCount || 1
      },
      actions: [
        { action: 'view', title: 'Görüntüle' },
        { action: 'close', title: 'Kapat' }
      ],
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      tag: notificationData?.type || 'general',
      renotify: true,
      timestamp: Date.now()
    };

    // Tüm subscription'lara gönder
    const results = [];
    for (const doc of subscriptionsSnapshot.docs) {
      const subscriptionData = doc.data();
      const subscription = {
        endpoint: subscriptionData.endpoint,
        keys: {
          p256dh: subscriptionData.p256dh,
          auth: subscriptionData.auth
        }
      };

      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        results.push({ success: true, subscriptionId: doc.id });
      } catch (error) {
        console.error(`Error sending to subscription ${doc.id}:`, error);
        // Geçersiz subscription'ı sil
        if (error.statusCode === 410 || error.statusCode === 404) {
          await doc.ref.delete();
        results.push({ success: false, subscriptionId: doc.id, error: error.message });
      }
    }

    return {
      success: true,
      sentCount: results.filter(r => r.success).length,
      totalCount: subscriptionsSnapshot.size,
      results
    };
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { success: false, message: error.message };
  }
});

/**
 * Firestore trigger: Poll oluşturulduğunda bildirim gönder
 */
exports.onPollCreated = functions.firestore
  .document('polls/{pollId}')
  .onCreate(async (snap, context) => {
    const pollData = snap.data();
    
    try {
      // Firestore'dan tüm subscription'ları al
      const subscriptionsSnapshot = await admin.firestore()
        .collection('push_subscriptions')
        .get();

      if (subscriptionsSnapshot.empty) {
        return null;
      }

      const payload = {
        title: 'Yeni Anket/Oylama Oluşturuldu',
        body: `${pollData.title} - Katılımınızı bekliyoruz!`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          type: 'poll',
          pollId: context.params.pollId,
          action: 'view'
        },
        actions: [
          { action: 'view', title: 'Görüntüle' },
          { action: 'close', title: 'Kapat' }
        ],
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200],
        tag: 'poll',
        renotify: true,
        timestamp: Date.now()
      };

      // Tüm subscription'lara gönder
      const results = [];
      for (const doc of subscriptionsSnapshot.docs) {
        const subscriptionData = doc.data();
        const subscription = {
          endpoint: subscriptionData.endpoint,
          keys: {
            p256dh: subscriptionData.p256dh,
            auth: subscriptionData.auth
          }
        };

        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload));
          results.push({ success: true, subscriptionId: doc.id });
        } catch (error) {
          console.error(`Error sending to subscription ${doc.id}:`, error);
          if (error.statusCode === 410 || error.statusCode === 404) {
            await doc.ref.delete();
          }
        }
      }

      console.log(`✅ Poll notification sent to ${results.filter(r => r.success).length} users`);
      return null;
    } catch (error) {
      console.error('Error in onPollCreated:', error);
      return null;
    }
  });

/**
 * Firestore trigger: Meeting oluşturulduğunda bildirim gönder
 */
exports.onMeetingCreated = functions.firestore
  .document('meetings/{meetingId}')
  .onCreate(async (snap, context) => {
    const meetingData = snap.data();
    
    try {
      const subscriptionsSnapshot = await admin.firestore()
        .collection('push_subscriptions')
        .get();

      if (subscriptionsSnapshot.empty) {
        return null;
      }

      const payload = {
        title: 'Yeni Toplantı Oluşturuldu',
        body: `${meetingData.name} - ${meetingData.date || 'Tarih belirtilmemiş'}`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          type: 'meeting',
          meetingId: context.params.meetingId,
          action: 'view'
        },
        actions: [
          { action: 'view', title: 'Görüntüle' },
          { action: 'close', title: 'Kapat' }
        ],
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200],
        tag: 'meeting',
        renotify: true,
        timestamp: Date.now()
      };

      for (const doc of subscriptionsSnapshot.docs) {
        const subscriptionData = doc.data();
        const subscription = {
          endpoint: subscriptionData.endpoint,
          keys: {
            p256dh: subscriptionData.p256dh,
            auth: subscriptionData.auth
          }
        };

        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload));
        } catch (error) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await doc.ref.delete();
          }
        }
      }

      console.log(`✅ Meeting notification sent`);
      return null;
    } catch (error) {
      console.error('Error in onMeetingCreated:', error);
      return null;
    }
  });

/**
 * Firestore trigger: Event oluşturulduğunda bildirim gönder
 */
exports.onEventCreated = functions.firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
    const eventData = snap.data();
    
    try {
      const subscriptionsSnapshot = await admin.firestore()
        .collection('push_subscriptions')
        .get();

      if (subscriptionsSnapshot.empty) {
        return null;
      }

      const payload = {
        title: 'Yeni Etkinlik Oluşturuldu',
        body: `${eventData.name} - ${eventData.date || 'Tarih belirtilmemiş'}`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          type: 'event',
          eventId: context.params.eventId,
          action: 'view'
        },
        actions: [
          { action: 'view', title: 'Görüntüle' },
          { action: 'close', title: 'Kapat' }
        ],
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200],
        tag: 'event',
        renotify: true,
        timestamp: Date.now()
      };

      for (const doc of subscriptionsSnapshot.docs) {
        const subscriptionData = doc.data();
        const subscription = {
          endpoint: subscriptionData.endpoint,
          keys: {
            p256dh: subscriptionData.p256dh,
            auth: subscriptionData.auth
          }
        };

        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload));
        } catch (error) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await doc.ref.delete();
          }
        }
      }

      console.log(`✅ Event notification sent`);
      return null;
    } catch (error) {
      console.error('Error in onEventCreated:', error);
      return null;
    }
  });
```

---

### ADIM 5: package.json Güncelleme

`sekreterlik-app/functions/package.json` dosyasını kontrol edin:

```json
{
  "name": "functions",
  "description": "Cloud Functions for Firebase",
  "scripts": {
    "serve": "firebase emulators:start --only functions",
    "shell": "firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "18"
  },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.5.0",
    "web-push": "^3.6.6"
  },
  "devDependencies": {
    "eslint": "^8.15.0",
    "eslint-config-google": "^0.14.0"
  },
  "private": true
}
```

---

### ADIM 6: Firebase Projesini Seçme

```bash
# Firebase projesini seç
firebase use --add

# Proje ID'nizi seçin (örn: yrpilsekreterligi)
```

---

### ADIM 7: Deploy Etme

```bash
# Functions'ı deploy et
firebase deploy --only functions

# Veya sadece belirli function'ı deploy et
firebase deploy --only functions:sendPushNotification
```

---

### ADIM 8: Client-Side'da Kullanım

`FirebaseApiService.js`'de `sendTestNotification` metodunu güncelleyin:

```javascript
static async sendTestNotification(userId = null) {
  try {
    // Firebase Functions'ı çağır
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { getApp } = await import('../config/firebase');
    
    const functions = getFunctions(getApp());
    const sendPushNotification = httpsCallable(functions, 'sendPushNotification');
    
    const result = await sendPushNotification({
      title: 'Test Bildirimi',
      body: 'Bu bir test bildirimidir. Push notification sistemi çalışıyor!',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: { type: 'test', action: 'view' },
      badgeCount: 1
    });
    
    return result.data;
  } catch (error) {
    console.error('Error sending test notification:', error);
    return {
      success: false,
      message: error.message || 'Test bildirimi gönderilirken hata oluştu'
    };
  }
}
```

---

## 💰 Firebase Cloud Functions Maliyeti

### Ücretsiz Kotası (Spark Plan):
- **2 milyon invocation/ay** (ücretsiz)
- **400,000 GB-saniye/ay** (ücretsiz)
- **200,000 CPU-saniye/ay** (ücretsiz)

### Blaze Plan (Kullandıkça Öde):
- İlk 2 milyon invocation ücretsiz
- Sonrası: $0.40 / 1 milyon invocation
- **Çok düşük maliyet!** (1000 bildirim ≈ $0.0004)

---

## ✅ Kurulum Sonrası Kontrol

1. **Firebase Console'da kontrol edin:**
   - Firebase Console → Functions
   - Deployed function'ları görmelisiniz

2. **Test edin:**
   - Üye dashboard'da "Test Bildirimi" butonuna tıklayın
   - Site kapalıyken bile bildirim gelmeli

3. **Log'ları kontrol edin:**
   ```bash
   firebase functions:log
   ```

---

## 🔧 Sorun Giderme

### Hata: "Functions directory not found"
```bash
# functions klasöründe olduğunuzdan emin olun
cd sekreterlik-app/functions
firebase deploy --only functions
```

### Hata: "Permission denied"
```bash
# Firebase'e tekrar giriş yapın
firebase login
```

### Hata: "VAPID key invalid"
- VAPID key'lerin doğru olduğundan emin olun
- `server/services/pushNotificationService.js` dosyasındaki key'leri kullanın

---

## 📝 Özet

✅ **Seçenek 3 (In-App):** Site açıkken çalışır, kapalıyken çalışmaz  
✅ **Seçenek 1 (Cloud Functions):** Site kapalıyken bile çalışır (WhatsApp gibi)

Firebase Cloud Functions kurulumu tamamlandığında, gerçek push notification gönderebilirsiniz!

