# 🎱 Tombala Gecesi — Online Çok Oyunculu Türk Tombalası

Klasik Türk tombalasının tarayıcıda oynanan, gerçek zamanlı çok oyunculu hâli.
Oda kur, arkadaşlarına kodu gönder, kartlarınızı alın, torbadan çıkan sayıları
kartınızda yakalayın. İlk 1 satırı dolduran "Çinko" yapar, kartını tamamen
dolduran (3 satır) oyunu kazanır. 🏆

---

## 📁 Bu pakette ne var?

```
tombala/
├─ index.html            → Uygulamanın tek sayfası (lobi + oyun ekranı)
├─ style.css             → Tüm görsel tasarım (3D kart, torba, animasyonlar)
├─ app.js                → Oyun mantığı + Firebase senkronizasyonu
├─ firebase-config.js    → SENİN doldurman gereken Firebase ayarları
├─ manifest.json         → PWA (ana ekrana eklenebilir uygulama) ayarları
├─ sw.js                 → Çevrimdışı önbellek (service worker)
├─ icons/
│  ├─ icon-192.png
│  ├─ icon-512.png
│  ├─ apple-touch-icon.png
│  ├─ favicon.png
│  └─ share.png          → Sosyal medya paylaşım görseli
└─ README.md             → Bu dosya
```

## 🚀 Neden Firebase gerekiyor?

GitHub Pages **statik** dosya sunar — kendi başına oyuncular arasında "canlı"
veri paylaşamaz. Oyuncuların aynı odada birbirini görmesi, sayı çekilince
herkesin ekranının aynı anda güncellenmesi için ücretsiz bir **Firebase
Realtime Database** kullanıyoruz. Kurulumu 5 dakika sürer ve tamamen ücretsizdir
(Spark planı — küçük arkadaş grupları için fazlasıyla yeterli).

### Firebase kurulumu

1. https://console.firebase.google.com → Google hesabınla giriş yap →
   **"Add project"** ile yeni bir proje oluştur (isim istediğin gibi, örn. `tombala-gecesi`).
2. Sol menüden **Build → Realtime Database** → **Create Database** →
   bir konum seç → **"Start in test mode"** ile başlat.
   > Test mode, herkesin okuma/yazma yapabildiği açık bir kuraldır. Arkadaş
   > grubuyla oynamak için sorun değildir, ama linki halka açık paylaşmayacaksan
   > rahat ol. Daha sıkı kural istersen aşağıdaki "Güvenlik" bölümüne bak.
3. Sol üstteki dişli ikonu → **Project settings** → en aşağıda **"Your apps"**
   → **`</>`** (Web) simgesine tıkla → bir takma ad ver → **Register app**.
4. Sana bir `firebaseConfig = { apiKey: ..., ... }` objesi verilecek.
   Bu değerleri **`firebase-config.js`** dosyasındaki karşılıklarının üstüne yapıştır.
5. Kaydet. Artık oyun canlı senkronize olabilir.

### Güvenlik (opsiyonel ama önerilir)

Realtime Database → **Rules** sekmesine gidip aşağıdakini yapıştırabilirsin —
sadece `rooms` altında okuma/yazmaya izin verir, veritabanının başka
bir yerine erişimi kapatır:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    },
    "$other": {
      ".read": false,
      ".write": false
    }
  }
}
```

---

## 🌐 GitHub Pages'e yükleme

1. GitHub'da yeni bir repo oluştur (örn. `tombala-gecesi`).
2. Bu klasördeki **tüm dosyaları** (alt klasör `icons/` dahil) reponun kök
   dizinine yükle (sürükle-bırak veya `git push` ile).
3. Repo → **Settings → Pages** → "Build and deployment" altında
   **Source: Deploy from a branch** → Branch: `main` (veya `master`) / `/ (root)` seç → Save.
4. Birkaç dakika içinde `https://kullanici-adin.github.io/tombala-gecesi/`
   adresinde canlı olacak.
5. Telefonunda tarayıcıdan açıp "Ana ekrana ekle" dersen gerçek bir uygulama
   gibi ikonla çalışır (PWA).

> Not: `firebase-config.js` dosyasını doldurmadan siteyi açarsan, lobi
> ekranında Firebase ayarlarının eksik olduğunu söyleyen bir uyarı görürsün.

---

## 🎮 Oyun kuralları (uygulanan mantık)

- 1–90 arası 90 sayı, her oyuncunun kartında **3 satır × 9 sütun = 27 hücre**,
  her satırda 5 sayı + 4 boşluk olacak şekilde otomatik üretilir (sütunlar
  1-9, 10-19 … 80-90 aralıklarına göre, klasik tombala kart mantığıyla).
- Oda kurucusu = **oda sahibi**. Sadece o, 90 sayılık torbadan sayı açabilir.
- Torba, her biri kapalı bir kutu olan 90 hücre olarak gösterilir; hücrelerin
  arkasındaki sayılar oyun başında karıştırılmış sırayla önceden atanmıştır.
  Oda sahibi kapalı bir kutuya dokununca o sayı açığa çıkar, tüm oyunculara
  anlık yayılır, bir ses ve sesli okuma (Türkçe) ile bildirilir.
- Her oyuncu **kendi kartındaki** sayıyı, açılan sayı listesinde varsa
  kendisi işaretler (dokunur). Doğruysa sayı, orta üstteki "sıradaki sayı"
  topundan kartındaki hücreye yavaşça uçarak yerleşir.
- Bir oyuncu bir satırını tamamen doldurduğunda **"Çinko"** duyurusu tüm
  ekranlarda anlık bildirim (toast) olarak belirir.
- Kartını tamamen dolduran (3 satır / 15 sayı) ilk oyuncu **kazanır** —
  ekranda 🏆 ve kazananın adı büyük bir katman olarak gösterilir.
- Oyun bittikten sonra sadece **oda sahibi** "Yeni Oyun Başlat" ile aynı
  oyuncularla yeni bir eşleştirme (yeni kartlar, yeni torba) başlatabilir.

## 🧩 Bilinen sınırlamalar / geliştirme fikirleri

- Kartlar her oyuncu için birbirinden bağımsız üretilir (gerçek kağıt
  tombala defterlerindeki "6 kartlık şerit, 90 sayı bir kere" kuralı
  uygulanmaz) — dijital oyunlarda yaygın olan, basitleştirilmiş yaklaşımdır.
- Firebase test-mode kuralları herkese açık okuma/yazma verir; halka açık
  paylaşmadan önce yukarıdaki güvenlik kuralını uygulaman önerilir.
- Oda sahibi odadan çıkarsa oda "sahipsiz" kalır — istersen `app.js`
  içine "sahip çıkarsa yönetimi en eski oyuncuya aktar" mantığı ekleyebilirsin.
