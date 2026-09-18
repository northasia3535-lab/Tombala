// =============================================================
//  FIREBASE AYARLARI — BURAYI DOLDURMAN GEREKİYOR
// =============================================================
// Bu oyun, oyuncular arasında gerçek zamanlı senkronizasyon için
// ücretsiz bir Firebase Realtime Database kullanır. GitHub Pages
// sadece statik dosya sunar, kendi başına "canlı" veri paylaşımı
// yapamaz — bu yüzden ücretsiz bir Firebase projesi gerekiyor.
//
// Kurulum (5 dakika, ücretsiz):
// 1) https://console.firebase.google.com adresine git, Google
//    hesabınla giriş yap, "Add project" ile yeni proje oluştur.
// 2) Sol menüden "Build > Realtime Database" seç, "Create Database"
//    de, konum seç, "Start in test mode" ile başlat.
//    (Test mode kuralları demo/arkadaş grubu için yeterlidir.)
// 3) Proje ayarları (dişli ikonu) > "Project settings" > en altta
//    "Your apps" > "</>" (Web) simgesine tıkla, bir takma ad ver,
//    "Register app" de. Sana bir `firebaseConfig` objesi verecek.
// 4) O objedeki değerleri aşağıya kopyala.
//
// Detaylı adımlar README.md içinde de var.
// =============================================================

const firebaseConfig = {
  apiKey: "BURAYA_API_KEY",
  authDomain: "BURAYA_PROJE.firebaseapp.com",
  databaseURL: "https://BURAYA_PROJE-default-rtdb.firebaseio.com",
  projectId: "BURAYA_PROJE",
  storageBucket: "BURAYA_PROJE.appspot.com",
  messagingSenderId: "BURAYA_SENDER_ID",
  appId: "BURAYA_APP_ID"
};
