(function () {
  "use strict";

  // --- CONFIGURAÇÃO FIREBASE (Projeto gg-gestao) ---
  var firebaseConfig = {
    apiKey: "AIzaSyC06Bn7C-llo0B0vIfE7Nxq5vkEhBk2U-w",
    authDomain: "gg-gestao.firebaseapp.com",
    projectId: "gg-gestao",
    storageBucket: "gg-gestao.firebasestorage.app",
    messagingSenderId: "499414114342",
    appId: "1:499414114342:web:8d8b9e4f89fff9179706e7",
    measurementId: "G-57GXK9MQXY"
  };

  if (!window.firebase) {
    console.error("Firebase SDK não carregado!");
  } else if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  var db = window.firebase ? firebase.firestore() : null;
  var currentDeviceId = "";

  // Elementos
  var displayEl = document.getElementById("device-id-display");
  var statusEl = document.getElementById("status-message");
  var btnVerify = document.getElementById("btn-verify");
  var logoTrigger = document.getElementById("logo-trigger");
  
  var storeModal = document.getElementById("store-modal");
  var storeCodeInput = document.getElementById("store-code");
  var btnStoreCancel = document.getElementById("btn-store-cancel");
  var btnStoreOk = document.getElementById("btn-store-ok");

  // --- Lógica de Device ID ---
  function generateFallbackId() {
    var stored = localStorage.getItem("GG_FALLBACK_ID") || localStorage.getItem("GG_DEVICE_ID");
    if (stored && /^GG-[A-Za-z0-9]{4,8}$/.test(stored)) {
      return stored;
    }

    var randomValue;
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var randomBytes = new Uint32Array(1);
      window.crypto.getRandomValues(randomBytes);
      randomValue = randomBytes[0];
    } else {
      randomValue = Math.floor(Math.random() * 10000);
    }

    stored = "GG-" + ("0000" + (randomValue % 10000)).slice(-4);
    localStorage.setItem("GG_FALLBACK_ID", stored);
    return stored;
  }

  function fetchDeviceId(callback) {
    callback(generateFallbackId());
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status-box show " + (type || "waiting");
  }

  function registerDevice(id) {
    if (!db) {
      console.error("Firestore indisponível; não foi possível registrar o aparelho.");
      setStatus("Firebase não configurado. Não foi possível registrar o aparelho.", "error");
      return Promise.resolve(false);
    }

    var docRef = db.collection("devices").doc(id);
    return docRef.get().then(function(doc) {
      if (!doc.exists) {
        return docRef.set({
            deviceId: id,
            authorized: false,
            mode: "fixed",
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(function() {
            setStatus("Código registrado. Aguardando liberação.", "waiting");
            return true;
        });
      }
      return true;
    }).catch(function(e) {
      console.error("Erro ao registrar aparelho no Firestore:", e.code || e.message || e);
      setStatus("Não foi possível registrar o aparelho no Firebase. Verifique a conexão e as regras do Firestore.", "error");
      return false;
    });
  }

  function verifyAccess(id) {
    if (!db) {
      setStatus("Firebase não configurado.", "error");
      return;
    }
    btnVerify.textContent = "Verificando...";
    var docRef = db.collection("devices").doc(id);
    var configRef = db.collection("config").doc("global");

    Promise.all([docRef.get(), configRef.get()]).then(function(results) {
      btnVerify.textContent = "Verificar Liberação";
      var doc = results[0];
      var configDoc = results[1];

      if (doc.exists) {
        var data = doc.data();
        if (data.authorized === true) {
          if (data.expiry_date) {
            var exp = data.expiry_date.toDate();
            if (exp < new Date()) {
               setStatus("Aparelho Expirado", "error");
               return;
            }
          }

          var globalConfig = configDoc.exists ? configDoc.data() : {};
          var mode = data.playback_type || data.mode || "fixed";
          var user = (data.xtream_username || data.username || "").trim();
          var pass = (data.xtream_password || data.password || "").trim();
          var m3uUrl = (data.m3u_url || "").trim();
          var fixedUrl = (data.fixed_url || data.dns_url || "").trim();
          var isM3u =
            mode.toLowerCase().indexOf("m3u") !== -1 ||
            (!!m3uUrl && !fixedUrl) ||
            (!m3uUrl && fixedUrl.toLowerCase().indexOf(".m3u") !== -1);

          setStatus("Aparelho liberado! Conectando ao servidor...", "waiting");

          var resolvePromise;
          if (isM3u) {
            resolvePromise = Promise.resolve(m3uUrl || fixedUrl);
          } else if (window.DnsResolver) {
            resolvePromise = window.DnsResolver.resolveActiveDns({
              device: data,
              config: globalConfig,
              username: user,
              password: pass
            });
          } else {
            resolvePromise = Promise.resolve(data.xtream_url || fixedUrl || "https://dnsgood.site");
          }

          resolvePromise.then(function(workingDns) {
            workingDns = (workingDns || "").trim();
            if (!isM3u && !workingDns) {
              workingDns = "https://dnsgood.site";
            }
            var payload = {
              username: user,
              password: pass,
              dns: workingDns,
              mode: isM3u ? "m3u" : mode,
              userAgent: data.user_agent || data.userAgent || "IPTVSmartersPro",
              m3uUrl: isM3u ? (workingDns || m3uUrl) : m3uUrl
            };
            setStatus("Servidor conectado! Iniciando...", "success");

            return window.CryptoHelper.encrypt(payload).then(function(enc) {
              localStorage.setItem("GG_PLAYER_SECURE", enc);
              localStorage.setItem("GG_DEVICE_ID", id);
              window.location.replace("index.html");
            });
          }).catch(function(e) {
            console.error("Erro ao salvar credenciais ou resolver DNS:", e);
            setStatus("Erro ao conectar ao servidor. Tente novamente.", "error");
          });
        } else {
          setStatus("Aguardando liberação", "waiting");
        }
      } else {
        setStatus("Aguardando liberação", "waiting");
        registerDevice(id);
      }
    }).catch(function(err) {
      btnVerify.textContent = "Verificar Liberação";
      setStatus("Erro de conexão. Tente novamente.", "error");
    });
  }

  // --- Inicialização ---
  fetchDeviceId(function(id) {
    currentDeviceId = id;
    localStorage.setItem("GG_DEVICE_ID", id);
    displayEl.textContent = id;
    registerDevice(id);
  });

  btnVerify.addEventListener("click", function() {
    if (currentDeviceId) verifyAccess(currentDeviceId);
  });

  var btnTestMode = document.getElementById("btn-test-mode");
  if (btnTestMode) {
    btnTestMode.addEventListener("click", function() {
      setStatus("Carregando Modo Teste (GG-STORE)...", "waiting");
      verifyAccess("GG-STORE");
    });
  }

  // --- Backdoor Store ---
  var logoClicks = 0;
  var logoClickTimer = null;
  function handleLogoClick() {
    logoClicks++;
    clearTimeout(logoClickTimer);
    if (logoClicks >= 5) {
      logoClicks = 0;
      storeModal.classList.add("show");
      selectEl(storeCodeInput);
    } else {
      logoClickTimer = setTimeout(function() { logoClicks = 0; }, 2000);
    }
  }
  logoTrigger.addEventListener("click", handleLogoClick);

  btnStoreCancel.addEventListener("click", function() {
    storeModal.classList.remove("show");
    storeCodeInput.value = "";
    selectEl(btnVerify);
  });

  btnStoreOk.addEventListener("click", function() {
    var code = (storeCodeInput.value || "").trim().toUpperCase();
    if (code === "GG-STORE") {
      verifyAccess("GG-STORE");
    } else {
      storeCodeInput.value = "";
      setStatus("Código Store Inválido", "error");
      storeModal.classList.remove("show");
      selectEl(btnVerify);
    }
  });


  // --- Navegação remota por teclado ---
  var selEl = btnVerify;
  var _nativeClicked = false;
  var editing = false;
  
  // Lista de elementos focáveis baseada em onde estamos (modal vs pagina)
  function getFocusableItems() {
    if (storeModal.classList.contains("show")) {
      return [storeCodeInput, btnStoreCancel, btnStoreOk];
    }
    return [btnVerify, btnTestMode];
  }

  function selectEl(el) {
    if (!el) return;
    var list = [btnVerify, btnTestMode, storeCodeInput, btnStoreCancel, btnStoreOk];
    for (var i = 0; i < list.length; i++) {
      if(list[i]) list[i].classList.remove("lp-focus");
    }
    selEl = el;
    el.classList.add("lp-focus");
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch(e2){} }
  }

  function move(direction) {
    var items = getFocusableItems();
    var idx = items.indexOf(selEl);
    if (idx < 0) { selectEl(items[0]); return; }
    
    var nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < items.length) {
      selectEl(items[nextIdx]);
    }
  }

  function activate() {
    var el = document.activeElement;
    if (!el || el === document.body) el = selEl;
    if (!el) return;
    if (el.tagName === "INPUT") return; 
    if (typeof el.click === "function") el.click();
  }

  document.addEventListener("keydown", function(event) {
    var key = event.key || event.code || "";
    var code = event.keyCode || event.which || 0;
    var keyCodes = {
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
      Enter: 13,
      OK: 13,
      GoBack: 461,
      Back: 461,
      MediaPlay: 179,
      MediaPause: 19,
      MediaStop: 178,
      MediaFastForward: 228,
      MediaRewind: 227,
      ColorF0Red: 403,
      ColorF1Green: 404,
      ColorF2Yellow: 405,
      ColorF3Blue: 406
    };
    if (keyCodes[key]) code = keyCodes[key];

    // Tecla amarela como atalho pro backdoor
    if ((code === 400 || code === 405) && !storeModal.classList.contains("show")) {
      handleLogoClick(); 
      handleLogoClick(); handleLogoClick(); handleLogoClick(); handleLogoClick();
      event.preventDefault();
      return;
    }

    if (code === 461 || code === 10009 || code === 27 || code === 8) {
      if (storeModal.classList.contains("show")) {
        btnStoreCancel.click();
      }
      event.preventDefault();
      return;
    }

    if ([19, 179, 178, 227, 228, 403, 404, 406].indexOf(code) !== -1) {
      event.preventDefault();
      return;
    }

    if (code === 13) {
      if (selEl && selEl.tagName === "INPUT") {
         editing = true;
         return;
      }
      setTimeout(function () {
        if (!_nativeClicked) activate();
        _nativeClicked = false;
      }, 0);
      return;
    }

    if (code === 37) { move(-1); event.preventDefault(); }
    else if (code === 39) { move(1); event.preventDefault(); }
    else if (code === 38 || code === 40) { event.preventDefault(); }
  });

  document.addEventListener("click", function () { _nativeClicked = true; }, true);

  setTimeout(function() {
    selectEl(btnVerify);
  }, 200);

})();
