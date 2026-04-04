# Rollback Mekanizmasi

Bu dokuman, Firebase Hosting ve sunucu tarafinda sorun yasandiginda geri alma (rollback) adimlarini aciklar.

## Firebase Hosting Rollback

Firebase Hosting, her deployment'i bir "release" olarak saklar. Sorunlu bir deploy sonrasi onceki surume donebilirsiniz.

### Yontem 1: Firebase Console (Onerilen)

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. Projenizi secin
3. Sol menuden **Hosting** sekmesine gidin
4. **Release history** bolumunde onceki deploy'lari gorun
5. Geri donmek istediginiz surumdeki **uc nokta menusune (...)** tiklayin
6. **Rollback** secenegini tiklayin
7. Onaylayin

### Yontem 2: Firebase CLI

```bash
# Onceki release'leri listele
firebase hosting:channel:list

# Belirli bir site versiyonuna rollback
firebase hosting:rollback --site <SITE_ID>

# Belirli bir versiyona rollback
firebase hosting:rollback --site <SITE_ID> --version <VERSION_ID>
```

### Yontem 3: Git + Yeniden Deploy

```bash
# Sorunlu commit'i tespit et
git log --oneline -10

# Onceki kararlı commit'e geri don
git checkout <STABLE_COMMIT_HASH>

# Client'i yeniden build et
cd client
npm run build

# Firebase'e yeniden deploy et
firebase deploy --only hosting
```

## Sunucu (Render) Rollback

Render.com uzerinde deploy edilen backend icin:

### Render Dashboard

1. [Render Dashboard](https://dashboard.render.com/) adresine gidin
2. Ilgili servisi secin
3. **Deploys** sekmesine gidin
4. Onceki basarili deploy'u bulun
5. **Redeploy** butonuna tiklayin

### Git Tabanli Rollback

```bash
# Onceki kararlı commit'e revert
git revert HEAD
git push origin main

# Render otomatik olarak yeni deploy baslatar
```

## Veritabani Rollback

### SQLite Backup'tan Geri Yukleme

```bash
# Mevcut backup'lari listele
ls server/backups/

# Backup'tan geri yukle (sunucuyu durdurun)
cp server/backups/database_YYYYMMDD_HHMMSS.sqlite server/database.sqlite

# Sunucuyu yeniden baslatin
```

### Firebase Firestore

1. Firebase Console > Firestore Database > Importlama/Disari aktarma
2. Onceden alinmis export'tan geri yukleyin

## Kontrol Listesi

Rollback sonrasi asagidaki kontrolleri yapin:

- [ ] Uygulama erisilebildigini dogrulayin (health check)
- [ ] Login islemi calisiyor mu?
- [ ] Uye listesi yuklenebiliyor mu?
- [ ] API endpointleri dogru cevap veriyor mu?
- [ ] Firebase baglantisi calisiyor mu?
- [ ] SMS servisi calisiyor mu?

## Acil Durum Iletisim

Rollback islemleri sirasinda sorun yasanirsa:
- Sunucu loglarini kontrol edin: `server/logs/`
- Firebase status sayfasini kontrol edin: https://status.firebase.google.com/
- Render status sayfasini kontrol edin: https://status.render.com/
