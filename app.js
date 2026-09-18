/* =====================================================================
   TOMBALA GECESİ — app.js
   Gerçek zamanlı çok oyunculu Türk tombalası.
   Firebase Realtime Database üzerinden senkronizasyon.
   ===================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   *  0) FIREBASE BAŞLAT
   * ------------------------------------------------------------------ */
  let db = null;
  let firebaseReady = false;
  try {
    if (typeof firebaseConfig !== "undefined" && firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf("BURAYA") === -1) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      firebaseReady = true;
    }
  } catch (e) {
    console.error("Firebase başlatılamadı:", e);
  }

  /* ------------------------------------------------------------------ *
   *  1) YARDIMCI FONKSİYONLAR
   * ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function uid(len) {
    len = len || 12;
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function roomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışıklık yaratan harfler çıkarıldı
    let s = "";
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getMyPlayerId() {
    let id = localStorage.getItem("tombala_pid");
    if (!id) {
      id = uid(16);
      localStorage.setItem("tombala_pid", id);
    }
    return id;
  }

  const ONES = ["bir","iki","üç","dört","beş","altı","yedi","sekiz","dokuz"];
  const TENS = ["on","yirmi","otuz","kırk","elli","altmış","yetmiş","seksen","doksan"];
  function numberToTurkish(n) {
    if (n === 90) return "doksan";
    if (n < 10) return ONES[n - 1];
    const t = Math.floor(n / 10), o = n % 10;
    let s = TENS[t - 1];
    if (o > 0) s += " " + ONES[o - 1];
    return s;
  }

  // Çinko duyuruları için Türkçe sıra sayıları ("Birinci Çinko", "İkinci
  // Çinko" gibi) — 20'ye kadar yazıyla, sonrası "21. Çinko" şeklinde sayıyla.
  const ORDINAL_WORDS = ["Birinci","İkinci","Üçüncü","Dördüncü","Beşinci","Altıncı","Yedinci","Sekizinci","Dokuzuncu","Onuncu","Onbirinci","Onikinci","Onüçüncü","Ondördüncü","Onbeşinci","Onaltıncı","Onyedinci","Onsekizinci","Ondokuzuncu","Yirminci"];
  function ordinalTurkish(n) {
    if (n >= 1 && n <= ORDINAL_WORDS.length) return ORDINAL_WORDS[n - 1];
    return `${n}.`;
  }

  /* ------------------------------------------------------------------ *
   *  2) TOMBALA KARTI ÜRETİMİ  (3 satır x 9 sütun, satırda 5 sayı)
   * ------------------------------------------------------------------ */
  const COL_RANGES = [[1,9],[10,19],[20,29],[30,39],[40,49],[50,59],[60,69],[70,79],[80,90]];

  function buildLayout() {
    // Her sütun için 1..3 arası sayı adedi belirle, toplam 15 olacak şekilde.
    for (let attempt = 0; attempt < 500; attempt++) {
      const counts = new Array(9).fill(1);
      let remaining = 15 - 9;
      while (remaining > 0) {
        const idx = Math.floor(Math.random() * 9);
        if (counts[idx] < 3) { counts[idx]++; remaining--; }
      }
      const rowsRemaining = [5, 5, 5];
      const matrix = [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]];
      let colsOrder = [0,1,2,3,4,5,6,7,8];
      colsOrder = shuffle(colsOrder).sort((a, b) => counts[b] - counts[a]);

      let ok = true;
      for (const col of colsOrder) {
        const need = counts[col];
        let availableRows = [0, 1, 2].filter(r => rowsRemaining[r] > 0);
        if (availableRows.length < need) { ok = false; break; }
        availableRows.sort((a, b) => (rowsRemaining[b] - rowsRemaining[a]) + (Math.random() - 0.5));
        const chosen = availableRows.slice(0, need);
        for (const r of chosen) { matrix[r][col] = 1; rowsRemaining[r]--; }
      }
      if (ok && rowsRemaining.every(v => v === 0)) {
        return { matrix, counts };
      }
    }
    throw new Error("Kart düzeni üretilemedi");
  }

  function generateCard() {
    const { matrix, counts } = buildLayout();
    const card = [[null,null,null,null,null,null,null,null,null],
                  [null,null,null,null,null,null,null,null,null],
                  [null,null,null,null,null,null,null,null,null]];
    for (let col = 0; col < 9; col++) {
      const [lo, hi] = COL_RANGES[col];
      const pool = [];
      for (let n = lo; n <= hi; n++) pool.push(n);
      const picked = shuffle(pool).slice(0, counts[col]).sort((a, b) => a - b);
      const rowsWithNum = [];
      for (let r = 0; r < 3; r++) if (matrix[r][col]) rowsWithNum.push(r);
      rowsWithNum.sort((a, b) => a - b);
      for (let i = 0; i < rowsWithNum.length; i++) card[rowsWithNum[i]][col] = picked[i];
    }
    return card;
  }

  // Her oyunda kartlara farklı bir renk atanır (gerçek tombala setlerindeki
  // gibi turuncu, mavi, yeşil, mor... kartlar) — sayılar her zaman beyaz
  // zeminde kalır, sadece BOŞ hücrelerin rengi değişir (bkz. style.css).
  const CARD_COLORS = ["orange", "blue", "green", "purple", "teal", "rose"];
  function pickCardColors(playerIds) {
    const shuffled = shuffle(CARD_COLORS);
    const assign = {};
    playerIds.forEach((pid, i) => {
      assign[pid] = shuffled[i % shuffled.length];
    });
    return assign;
  }

  /* ------------------------------------------------------------------ *
   *  3) SES  (WebAudio ile "ding" — dosya gerektirmez, PWA'da da çalışır)
   * ------------------------------------------------------------------ */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no-op */ }
    }
    // Mobil tarayıcılar (özellikle iOS Safari/Chrome) AudioContext'i
    // "suspended" durumda başlatır ve kullanıcı bir yere dokunana kadar
    // ses üretmez. Her sesten önce tekrar resume() denemek, mobilde
    // sesin hiç çıkmaması sorununun en sık sebebini çözer.
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }
  // iOS/Android'de ses (hem WebAudio hem sesli okuma) yalnızca bir
  // kullanıcı dokunuşu/tıklaması İÇİNDE başlatılırsa kilidi açılır.
  // Sayfa yüklenince otomatik çalan sesler (torbadan sayı çıkması gibi)
  // bir kullanıcı jesti içinde OLMADIĞI için mobilde sessiz kalır.
  // Bu yüzden ilk dokunuşta/tıklamada sesi ve sesli okumayı "kilidini
  // açan" boş bir ses ile bir kez tetikliyoruz.
  let audioUnlocked = false;
  function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const ctx = ensureAudio();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    if (ctx) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain).connect(ctx.destination);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.01);
      } catch (e) { /* no-op */ }
    }
    if ("speechSynthesis" in window) {
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch (e) { /* no-op */ }
    }
  }
  ["touchstart", "click"].forEach(evt => {
    document.addEventListener(evt, unlockAudioOnce, { once: true, passive: true });
  });
  // Sayı çağrısı sesi — önceki sürüm çok tiz (880/1320 Hz sine) geliyordu;
  // daha alçak notalar + hafif bir low-pass filtre ile yumuşak, kulak
  // tırmalamayan bir "ding" sağlanır.
  function playChime() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2200;
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.13, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }
  // Çinko yapıldığında çalan, sesli okumadan bağımsız, garantili bir ton
  // üçlüsü — bazı tarayıcılarda sesli okuma (TTS) sessiz kalabildiği için
  // bu WebAudio tonu her zaman duyulur bir bildirim sağlar.
  function playCinkoFanfare() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = now + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  // Kazananın tüm kartını doldurduğu anda çalan, daha uzun/zengin final tonu.
  function playWinFanfare() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659, 784, 1047, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const t = now + i * 0.14;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  function speakNumber(n) {
    speakText(numberToTurkish(n));
  }
  // Bazı tarayıcılarda sesler (voices) sayfa yüklenir yüklenmez hazır
  // olmayabilir — ilk çağrıda boş liste dönerse 'voiceschanged' olayını
  // bekleyip Türkçe bir ses bulunduğunda onu kullanırız. Bu, "sayı
  // seslendirilmiyor" şikayetinin en sık sebebidir.
  let cachedVoices = [];
  let voicesReady = false;
  function primeVoices() {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length) { cachedVoices = v; voicesReady = true; }
    };
    load();
    if (!voicesReady) {
      window.speechSynthesis.addEventListener("voiceschanged", load, { once: false });
    }
  }
  function pickTurkishVoice() {
    if (!cachedVoices.length) return null;
    return cachedVoices.find(v => v.lang && v.lang.toLowerCase().startsWith("tr")) || null;
  }
  function speakText(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "tr-TR";
      u.rate = 0.98;
      const trVoice = pickTurkishVoice();
      if (trVoice) u.voice = trVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* no-op */ }
  }

  /* ------------------------------------------------------------------ *
   *  4) UYGULAMA DURUMU
   * ------------------------------------------------------------------ */
  const myId = getMyPlayerId();
  let myName = "";
  let currentRoomCode = null;
  let roomRef = null;
  let roomListener = null;
  let lastRoomSnapshot = null;
  let lastRenderedCallIdx = null;
  let lastCinkoCount = 0;
  let winOverlayShown = false;
  let winDismissedLocally = false;

  function toast(msg, big) {
    const layer = $("toastLayer");
    const el = document.createElement("div");
    el.className = "toast" + (big ? " toast--big" : "");
    el.textContent = msg;
    layer.appendChild(el);
    setTimeout(() => el.remove(), big ? 4200 : 2900);
  }

  function showView(name) {
    $("view-lobby").classList.toggle("hidden", name !== "lobby");
    $("view-game").classList.toggle("hidden", name !== "game");
  }

  /* ------------------------------------------------------------------ *
   *  5) LOBİ EKRANI
   * ------------------------------------------------------------------ */
  const nameInput = $("nameInput");
  const codeInput = $("codeInput");
  const lobbyMsg = $("lobbyMsg");

  const savedName = localStorage.getItem("tombala_name");
  if (savedName) nameInput.value = savedName;

  function setLobbyMsg(msg, ok) {
    lobbyMsg.textContent = msg || "";
    lobbyMsg.classList.toggle("ok", !!ok);
  }

  function requireFirebase() {
    if (!firebaseReady) {
      setLobbyMsg("⚠️ Firebase ayarları eksik. firebase-config.js dosyasını doldurman gerekiyor (README.md'ye bak).", false);
      return false;
    }
    return true;
  }

  $("btnCreateRoom").addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) { setLobbyMsg("Önce adını yaz.", false); return; }
    if (!requireFirebase()) return;
    myName = name;
    localStorage.setItem("tombala_name", name);
    const code = roomCode();
    const roomData = {
      createdAt: Date.now(),
      ownerId: myId,
      status: "lobby",
      cinkoCount: 0,
      cinkoLog: {},
      winnerId: null,
      winnerName: null,
      numberOrder: null,
      calledTileIndexes: {},
      currentCallIndex: null,
      players: {
        [myId]: { name: myName, joinedAt: Date.now(), online: true }
      }
    };
    db.ref("rooms/" + code).set(roomData)
      .then(() => enterRoom(code))
      .catch(err => setLobbyMsg("Oda oluşturulamadı: " + err.message, false));
  });

  $("btnJoinRoom").addEventListener("click", () => {
    const name = nameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();
    if (!name) { setLobbyMsg("Önce adını yaz.", false); return; }
    if (!code) { setLobbyMsg("Oda kodunu yaz.", false); return; }
    if (!requireFirebase()) return;
    myName = name;
    localStorage.setItem("tombala_name", name);
    db.ref("rooms/" + code).once("value").then(snap => {
      if (!snap.exists()) { setLobbyMsg("Bu kodla bir oda bulunamadı.", false); return; }
      const room = snap.val();
      const playerCount = room.players ? Object.keys(room.players).length : 0;
      if (!room.players || !room.players[myId]) {
        if (playerCount >= 10) { setLobbyMsg("Oda dolu (10/10).", false); return; }
      }
      db.ref(`rooms/${code}/players/${myId}`).set({ name: myName, joinedAt: Date.now(), online: true })
        .then(() => enterRoom(code))
        .catch(err => setLobbyMsg("Odaya katılınamadı: " + err.message, false));
    }).catch(err => setLobbyMsg("Hata: " + err.message, false));
  });

  $("btnCopyCode").addEventListener("click", () => {
    if (!currentRoomCode) return;
    navigator.clipboard && navigator.clipboard.writeText(currentRoomCode);
    toast("Oda kodu kopyalandı: " + currentRoomCode);
  });

  $("btnStartMatch").addEventListener("click", () => {
    if (!currentRoomCode) return;
    startMatch(currentRoomCode);
  });

  $("btnLeaveRoom").addEventListener("click", () => {
    leaveRoom();
  });

  /* ------------------------------------------------------------------ *
   *  6) ODAYA GİRİŞ + DİNLEYİCİ
   * ------------------------------------------------------------------ */
  function enterRoom(code) {
    currentRoomCode = code;
    $("roomCodeText").textContent = code;
    $("gameRoomCode").textContent = code;
    $("meName").textContent = myName;
    $("roomPanel").classList.remove("hidden");
    setLobbyMsg("Odaya bağlanıldı. Diğer oyuncuları bekleyebilirsin.", true);

    roomRef = db.ref("rooms/" + code);
    roomRef.child(`players/${myId}/online`).onDisconnect().set(false);

    roomListener = roomRef.on("value", snap => {
      const room = snap.val();
      if (!room) return;
      lastRoomSnapshot = room;
      renderRoom(room);
    });
  }

  function leaveRoom() {
    if (roomRef && roomListener) roomRef.off("value", roomListener);
    if (currentRoomCode) {
      db.ref(`rooms/${currentRoomCode}/players/${myId}`).remove().catch(() => {});
    }
    currentRoomCode = null;
    roomRef = null;
    lastRoomSnapshot = null;
    winOverlayShown = false;
    lastRenderedCallIdx = null;
    lastCinkoCount = 0;
    $("roomPanel").classList.add("hidden");
    $("winOverlay").classList.add("hidden");
    setLobbyMsg("", false);
    showView("lobby");
  }

  /* ------------------------------------------------------------------ *
   *  7) ODA DURUMUNU EKRANA ÇİZ
   * ------------------------------------------------------------------ */
  function renderRoom(room) {
    const players = room.players || {};
    const playerIds = Object.keys(players);
    const iAmOwner = room.ownerId === myId;

    if (room.status !== "finished") {
      winDismissedLocally = false;
    }

    if (room.status === "lobby") {
      showView("lobby");
      renderLobbyPlayers(players, room);
    } else {
      showView("game");
      renderGameTopbar(room, players, iAmOwner);
      $("gameMain").classList.remove("hidden");
      renderCallArea(room);
      renderBoard(room, iAmOwner);
      renderMyCard(room, players[myId]);
      autoMarkCalledNumber(room, players[myId]);
      renderHostControls(room, iAmOwner);
      renderCinkoAndWinner(room, players);
    }
  }

  function renderLobbyPlayers(players, room) {
    const ids = Object.keys(players);
    $("playerCountLabel").textContent = `👥 Oyuncular (${ids.length}/10)`;
    const list = $("playersList");
    list.innerHTML = "";
    ids.sort((a, b) => (players[a].joinedAt || 0) - (players[b].joinedAt || 0));
    ids.forEach((pid, i) => {
      const li = document.createElement("li");
      const isOwner = room.ownerId === pid;
      li.innerHTML = `<span class="p-emoji">🎮</span> ${i + 1}. ${escapeHtml(players[pid].name || "Oyuncu")}` +
        (isOwner ? `<span class="p-crown">👑</span>` : "");
      list.appendChild(li);
    });
    const iAmOwner = room.ownerId === myId;
    const btn = $("btnStartMatch");
    const startHint = $("startHint");
    if (iAmOwner) {
      btn.disabled = ids.length < 1;
      startHint.textContent = ids.length < 1 ? "Oyuncu bekleniyor…" : "Herkes hazır olduğunda başlat!";
    } else {
      btn.disabled = true;
      startHint.textContent = "Sadece oda sahibi oyunu başlatabilir.";
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function renderGameTopbar(room, players, iAmOwner) {
    $("meName").textContent = myName || (players[myId] && players[myId].name) || "Oyuncu";
    $("meCrown").classList.toggle("hidden", !iAmOwner);
    $("gameRoomCode").textContent = currentRoomCode;

    const strip = $("playersStrip");
    strip.innerHTML = "";
    const ids = Object.keys(players).sort((a, b) => (players[a].joinedAt || 0) - (players[b].joinedAt || 0));
    ids.forEach(pid => {
      const p = players[pid];
      const rows = p.rowsCompleted || [false, false, false];
      const pill = document.createElement("div");
      pill.className = "player-pill" + (pid === room.ownerId ? " is-owner" : "") + (pid === myId ? " is-me" : "");
      pill.innerHTML = `${pid === room.ownerId ? "👑" : "🎮"} ${escapeHtml(p.name || "Oyuncu")}
        <span class="dots">
          <span class="dot ${rows[0] ? "on" : ""}"></span>
          <span class="dot ${rows[1] ? "on" : ""}"></span>
          <span class="dot ${rows[2] ? "on" : ""}"></span>
        </span>`;
      strip.appendChild(pill);
    });
  }

  /* ------------------------------------------------------------------ *
   *  8) EŞLEŞTİRMEYİ BAŞLAT / YENİ OYUN  (sadece oda sahibi)
   * ------------------------------------------------------------------ */
  function startMatch(code) {
    const rref = db.ref("rooms/" + code);
    rref.once("value").then(snap => {
      const room = snap.val();
      if (!room || room.ownerId !== myId) return;
      const players = room.players || {};
      const playerIds = Object.keys(players);
      const colors = pickCardColors(playerIds);
      const updates = {};
      playerIds.forEach(pid => {
        updates[`players/${pid}/card`] = generateCard();
        updates[`players/${pid}/marked`] = {};
        updates[`players/${pid}/rowsCompleted`] = [false, false, false];
        updates[`players/${pid}/cardColor`] = colors[pid];
      });
      updates["status"] = "playing";
      updates["numberOrder"] = shuffle(Array.from({ length: 90 }, (_, i) => i + 1));
      updates["calledTileIndexes"] = {};
      updates["currentCallIndex"] = null;
      updates["cinkoCount"] = 0;
      updates["cinkoLog"] = {};
      updates["winnerId"] = null;
      updates["winnerName"] = null;
      rref.update(updates);
    });
  }

  $("btnNewGame").addEventListener("click", () => startMatch(currentRoomCode));
  $("btnNewGameOverlay").addEventListener("click", () => {
    startMatch(currentRoomCode);
    $("winOverlay").classList.add("hidden");
    winOverlayShown = false;
    winDismissedLocally = false;
  });

  // Herkes (oda sahibi dahil) bu butonla kazanan katmanını kapatıp kartı/
  // torbayı görebilir; oyun durumu değişmez, sadece kendi ekranımızdan
  // kapatılır. Oda sahibi yeni oyun başlatınca herkeste otomatik açılır.
  $("btnCloseWinOverlay").addEventListener("click", () => {
    $("winOverlay").classList.add("hidden");
    winDismissedLocally = true;
  });

  function renderHostControls(room, iAmOwner) {
    const show = iAmOwner && room.status === "finished";
    $("hostControls").classList.toggle("hidden", !show);
    $("btnNewGame").classList.toggle("hidden", !show);
  }

  /* ------------------------------------------------------------------ *
   *  9) ÇAĞRI ALANI (sıradaki sayı + geçmiş şeridi)
   * ------------------------------------------------------------------ */
  function renderCallArea(room) {
    const order = room.numberOrder || [];
    const calledMap = room.calledTileIndexes || {};
    const calledIdxList = Object.keys(calledMap).map(Number).sort((a, b) => calledMap[a] - calledMap[b]);
    const curIdx = room.currentCallIndex;
    const curNum = (curIdx !== null && curIdx !== undefined && order[curIdx]) ? order[curIdx] : null;

    const ballEl = $("currentCallBall");
    const numEl = $("currentCallNumber");
    const isNew = curIdx !== null && curIdx !== undefined && curIdx !== lastRenderedCallIdx;

    numEl.textContent = curNum !== null ? curNum : "–";

    if (isNew) {
      lastRenderedCallIdx = curIdx;
      ballEl.classList.remove("pulse");
      requestAnimationFrame(() => {
        ballEl.classList.add("pulse");
        playChime();
        speakNumber(curNum);
      });
    }

    const hist = $("calledHistoryStrip");
    hist.innerHTML = "";
    calledIdxList.forEach(idx => {
      const n = order[idx];
      const chip = document.createElement("div");
      chip.className = "hist-chip" + (idx === curIdx ? " latest" : "");
      chip.textContent = n;
      hist.appendChild(chip);
    });
    // en son çağrılan sağda görünsün + otomatik kaydır
    hist.scrollLeft = hist.scrollWidth;
  }

  /* ------------------------------------------------------------------ *
   *  10) SAYI TORBASI (90 kapalı/açık kutu) — sadece oda sahibi açabilir
   * ------------------------------------------------------------------ */
  function renderBoard(room, iAmOwner) {
    const order = room.numberOrder || [];
    const calledMap = room.calledTileIndexes || {};
    const board = $("numberBoard");
    $("boardOwnerHint").textContent = iAmOwner ? "Sırayı sen açıyorsun" : "Sadece oda sahibi açabilir";

    // basit bir diff-render: eleman sayısı tutuyorsa sadece sınıfları güncelle
    if (board.children.length !== 90) {
      board.innerHTML = "";
      for (let i = 0; i < 90; i++) {
        const tile = document.createElement("div");
        tile.className = "tile closed";
        tile.dataset.idx = i;
        board.appendChild(tile);
      }
      board.addEventListener("click", onBoardTileClick);
    }

    for (let i = 0; i < 90; i++) {
      const tile = board.children[i];
      const isOpen = !!calledMap[i];
      const clickable = iAmOwner && room.status === "playing" && !isOpen;
      tile.classList.toggle("open", isOpen);
      tile.classList.toggle("closed", !isOpen);
      tile.classList.toggle("clickable", clickable);
      tile.classList.toggle("is-latest", isOpen && i === room.currentCallIndex);
      tile.textContent = isOpen ? String(order[i]) : "";
    }
  }

  function onBoardTileClick(e) {
    const tile = e.target.closest(".tile");
    if (!tile || !tile.classList.contains("clickable")) return;
    const idx = Number(tile.dataset.idx);
    if (!currentRoomCode) return;
    const room = lastRoomSnapshot;
    if (!room || room.ownerId !== myId || room.status !== "playing") return;

    const tileRef = db.ref(`rooms/${currentRoomCode}/calledTileIndexes/${idx}`);
    tileRef.transaction(cur => {
      if (cur) return; // zaten açılmış, dokunma
      return Date.now();
    }).then(result => {
      if (result.committed) {
        db.ref(`rooms/${currentRoomCode}/currentCallIndex`).set(idx);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   *  11) OYUNCUNUN KENDİ KARTI — işaretleme + uçuş animasyonu
   * ------------------------------------------------------------------ */
  function calledNumbersSet(room) {
    const order = room.numberOrder || [];
    const calledMap = room.calledTileIndexes || {};
    const s = new Set();
    Object.keys(calledMap).forEach(idx => s.add(order[Number(idx)]));
    return s;
  }

  function renderMyCard(room, me) {
    const wrap = $("myCard");
    if (!me || !me.card) { wrap.innerHTML = ""; return; }
    const card = me.card;
    const marked = me.marked || {};
    const called = calledNumbersSet(room);

    CARD_COLORS.forEach(c => wrap.classList.remove("card-" + c));
    if (me.cardColor) wrap.classList.add("card-" + me.cardColor);

    const needsBuild = wrap.children.length !== 27;
    if (needsBuild) {
      wrap.innerHTML = "";
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = document.createElement("div");
          cell.dataset.r = r; cell.dataset.c = c;
          wrap.appendChild(cell);
        }
      }
      wrap.addEventListener("click", onCardCellClick);
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = wrap.children[r * 9 + c];
        const val = card[r][c];
        if (val === null) {
          cell.className = "cell blank";
          cell.textContent = "";
          continue;
        }
        const isMarked = !!marked[val];
        const isCallable = !isMarked && called.has(val) && room.status === "playing";
        cell.className = "cell numbered" + (isMarked ? " marked" : "") + (isCallable ? " callable" : "");
        cell.textContent = val;
      }
    }

    // satır ilerleme noktaları
    const rows = me.rowsCompleted || [false, false, false];
    $("myRowsProgress").innerHTML = rows.map(d => `<span class="rdot ${d ? "done" : ""}"></span>`).join("");
  }

  // Sayılar torbadan açılınca kendiliğinden karta yerleşir (bkz.
  // autoMarkCalledNumber). Elle dokunma, olası bir gecikme durumunda
  // yedek olarak duruyor.
  // `animate=false` verilirse (eski/atlanmış bir çağrı için) uçuş
  // animasyonu olmadan, doğrudan hızlı bir "pop" ile işaretlenir.
  const pendingAutoMarks = new Set(); // DB yazması sürerken aynı sayının tekrar işlenmesini önler
  function markNumberForMe(val, cell, me, room, animate) {
    if (animate === undefined) animate = true;
    if (animate) {
      flyNumberToCell(val, cell);
    } else {
      cell.classList.add("pop");
      setTimeout(() => cell.classList.remove("pop"), 400);
    }
    const path = `rooms/${currentRoomCode}/players/${myId}`;
    db.ref(`${path}/marked/${val}`).set(true).then(() => {
      pendingAutoMarks.delete(val);
      checkRowsAndMaybeWin(room, me, val);
    });
  }

  function onCardCellClick(e) {
    const cell = e.target.closest(".cell.numbered");
    if (!cell || !currentRoomCode) return;
    const room = lastRoomSnapshot;
    if (!room || room.status !== "playing") return;
    const me = room.players && room.players[myId];
    if (!me || !me.card) return;

    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    const val = me.card[r][c];
    if (val === null) return;
    const marked = me.marked || {};
    if (marked[val]) return; // zaten işaretli (otomatik yerleşmiş olabilir)

    const called = calledNumbersSet(room);
    if (!called.has(val)) {
      cell.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
        { duration: 260 }
      );
      return; // torbadan henüz çıkmamış bir sayı işaretlenemez
    }

    markNumberForMe(val, cell, me, room);
  }

  // Oda sahibi bir sayı açtığı anda, kartımızdaki TÜM çağrılmış ama henüz
  // işaretlenmemiş sayılar taranır (sadece son açılan değil) — böylece
  // art arda hızlı açılan ya da yeniden bağlanma sırasında kaçırılmış
  // hiçbir sayı gözden kaçmaz. En son açılan sayı uçuş animasyonuyla,
  // geride kalmış olanlar ise hızlı bir "pop" ile anında işaretlenir.
  function autoMarkCalledNumber(room, me) {
    if (!room || room.status !== "playing" || !me || !me.card) return;
    const order = room.numberOrder || [];
    const curIdx = room.currentCallIndex;
    const curNum = (curIdx !== null && curIdx !== undefined) ? order[curIdx] : null;
    const called = calledNumbersSet(room);
    const marked = me.marked || {};
    const wrap = $("myCard");

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        const val = me.card[r][c];
        if (val === null) continue;
        if (marked[val]) continue;
        if (!called.has(val)) continue;
        if (pendingAutoMarks.has(val)) continue; // zaten yazılması bekleniyor
        pendingAutoMarks.add(val);

        const cell = wrap.children[r * 9 + c];
        const isLatest = (val === curNum);
        requestAnimationFrame(() => {
          markNumberForMe(val, cell, me, room, isLatest);
        });
      }
    }
  }

  function flyNumberToCell(number, targetEl) {
    const ballEl = $("currentCallBall");
    const startRect = ballEl.getBoundingClientRect();
    const endRect = targetEl.getBoundingClientRect();
    const size = 52;
    const sx = startRect.left + startRect.width / 2 - size / 2;
    const sy = startRect.top + startRect.height / 2 - size / 2;
    const ex = endRect.left + endRect.width / 2 - size / 2;
    const ey = endRect.top + endRect.height / 2 - size / 2;
    const midX = (sx + ex) / 2;
    const midY = Math.min(sy, ey) - 80;

    const token = document.createElement("div");
    token.className = "fly-token";
    token.textContent = number;
    $("flyLayer").appendChild(token);

    const anim = token.animate([
      { transform: `translate(${sx}px, ${sy}px) scale(1) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${midX}px, ${midY}px) scale(1.15) rotate(170deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${ex}px, ${ey}px) scale(0.5) rotate(340deg)`, opacity: 0.9 }
    ], { duration: 900, easing: "cubic-bezier(.22,.8,.32,1)" });

    anim.onfinish = () => {
      token.remove();
      targetEl.classList.add("pop");
      setTimeout(() => targetEl.classList.remove("pop"), 400);
    };
  }

  function checkRowsAndMaybeWin(room, me, justMarkedVal) {
    // en güncel işaretli sayılar (yerel + bu tıklama)
    const marked = Object.assign({}, me.marked || {}, { [justMarkedVal]: true });
    const card = me.card;
    const prevRows = me.rowsCompleted || [false, false, false];
    const newRows = [0, 1, 2].map(r => {
      const rowVals = card[r].filter(v => v !== null);
      return rowVals.every(v => marked[v]);
    });

    db.ref(`rooms/${currentRoomCode}/players/${myId}/rowsCompleted`).set(newRows);

    newRows.forEach((done, r) => {
      if (done && !prevRows[r]) {
        announceCinko();
      }
    });

    if (newRows.every(Boolean) && !prevRows.every(Boolean)) {
      declareWinner();
    }
  }

  function announceCinko() {
    const counterRef = db.ref(`rooms/${currentRoomCode}/cinkoCount`);
    counterRef.transaction(cur => (cur || 0) + 1).then(res => {
      if (res.committed) {
        const n = res.snapshot.val();
        db.ref(`rooms/${currentRoomCode}/cinkoLog/${n}`).set({ n, playerId: myId, playerName: myName, ts: Date.now() });
      }
    });
  }

  function declareWinner() {
    const winRef = db.ref(`rooms/${currentRoomCode}/winnerId`);
    winRef.transaction(cur => cur || myId).then(res => {
      if (res.committed && res.snapshot.val() === myId) {
        db.ref(`rooms/${currentRoomCode}`).update({
          winnerId: myId,
          winnerName: myName,
          status: "finished"
        });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   *  12) ÇİNKO BİLDİRİMLERİ + KAZANAN KATMANI
   * ------------------------------------------------------------------ */
  function renderCinkoAndWinner(room, players) {
    const count = room.cinkoCount || 0;
    const log = room.cinkoLog || {};
    if (count > lastCinkoCount) {
      for (let n = lastCinkoCount + 1; n <= count; n++) {
        const entry = log[n];
        if (entry) {
          const isFull = room.winnerId && entry.playerId === room.winnerId && n === count && room.status === "finished";
          if (!isFull) {
            const ord = ordinalTurkish(n);
            toast(`🪙 ${ord} Çinko — ${entry.playerName}!`, true);
            playCinkoFanfare();
            speakText(`${ord} Çinko, ${entry.playerName} yaptı!`);
          }
        }
      }
      lastCinkoCount = count;
    }

    const overlay = $("winOverlay");
    if (room.status === "finished" && room.winnerId) {
      const winnerLabel = room.winnerName || "Bilinmiyor";
      $("winnerName").textContent = winnerLabel;
      const iAmOwner = room.ownerId === myId;
      $("btnNewGameOverlay").classList.toggle("hidden", !iAmOwner);
      $("waitHostMsg").classList.toggle("hidden", iAmOwner);
      renderWinnerCardPreview(room, players[room.winnerId]);
      if (!winOverlayShown) {
        playWinFanfare();
        speakText(`Tombala! Kazanan ${winnerLabel}!`);
      }
      if (!winDismissedLocally) {
        overlay.classList.remove("hidden");
      }
      winOverlayShown = true;
    } else if (winOverlayShown) {
      overlay.classList.add("hidden");
      winOverlayShown = false;
    }
  }

  // Kazananın dolu kartını, herkesin inceleyebilmesi için kazanan
  // katmanında küçük, salt-okunur bir kopya olarak gösterir.
  function renderWinnerCardPreview(room, winner) {
    const wrap = $("winCardPreview");
    if (!wrap) return;
    if (!winner || !winner.card) { wrap.innerHTML = ""; return; }
    const card = winner.card;
    const marked = winner.marked || {};

    CARD_COLORS.forEach(c => wrap.classList.remove("card-" + c));
    if (winner.cardColor) wrap.classList.add("card-" + winner.cardColor);

    if (wrap.children.length !== 27) {
      wrap.innerHTML = "";
      for (let i = 0; i < 27; i++) wrap.appendChild(document.createElement("div"));
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = wrap.children[r * 9 + c];
        const val = card[r][c];
        if (val === null) {
          cell.className = "cell blank";
          cell.textContent = "";
        } else {
          const isMarked = !!marked[val];
          cell.className = "cell numbered" + (isMarked ? " marked" : "");
          cell.textContent = val;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   *  13) BAŞLANGIÇ
   * ------------------------------------------------------------------ */
  showView("lobby");
  primeVoices();

  if (!firebaseReady) {
    setLobbyMsg("⚠️ Firebase ayarları eksik. firebase-config.js dosyasını doldurman gerekiyor (bkz. README.md).", false);
  }

  // Service worker kaydı (PWA çevrimdışı destek)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { /* no-op */ });
    });
  }

})();
