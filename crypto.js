var CryptoHelper = (function() {
  var ALGO = "AES-GCM";
  var KEY_SIZE = 256;
  var STATIC_SALT = "GG_STATIC_SALT_8923"; 
  var subtle = window.crypto.subtle || window.crypto.webkitSubtle;

  function getDerivationKey(password) {
    var enc = new TextEncoder();
    return subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
  }

  function generateKey() {
    return getDerivationKey("gg_player_secret_key_material").then(function(keyMaterial) {
      var salt = new TextEncoder().encode(STATIC_SALT);
      return subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: ALGO, length: KEY_SIZE },
        false,
        ["encrypt", "decrypt"]
      );
    });
  }

  function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  return {
    encrypt: function(payloadObj) {
      return generateKey().then(function(key) {
        var iv = new Uint8Array(12);
        window.crypto.getRandomValues(iv);
        var enc = new TextEncoder();
        var encoded = enc.encode(JSON.stringify(payloadObj));

        return subtle.encrypt(
          {
            name: ALGO,
            iv: iv
          },
          key,
          encoded
        ).then(function(ciphertext) {
          var ivBase64 = arrayBufferToBase64(iv);
          var cipherBase64 = arrayBufferToBase64(ciphertext);
          return JSON.stringify({ iv: ivBase64, data: cipherBase64 });
        });
      });
    },
    
    decrypt: function(encryptedString) {
      return generateKey().then(function(key) {
        var parsed = JSON.parse(encryptedString);
        var iv = base64ToArrayBuffer(parsed.iv);
        var ciphertext = base64ToArrayBuffer(parsed.data);

        return subtle.decrypt(
          {
            name: ALGO,
            iv: new Uint8Array(iv)
          },
          key,
          ciphertext
        ).then(function(decrypted) {
          var dec = new TextDecoder();
          return JSON.parse(dec.decode(decrypted));
        });
      });
    }
  };
})();

var DnsResolver = (function () {
  var DEFAULT_FALLBACK_DNS = "https://dnsgood.site";

  function wrapWithProxy(url) {
    if (!url || typeof url !== "string") {
      return url;
    }
    var clean = url.trim();
    if (!clean) {
      return url;
    }
    var isHttps =
      typeof window !== "undefined" &&
      window.location &&
      window.location.protocol === "https:";
    if (!isHttps) {
      return clean;
    }
    if (clean.indexOf("/api/proxy") === 0 || clean.indexOf("api/proxy") === 0) {
      return clean;
    }
    if (clean.charAt(0) === "/" && clean.indexOf("//") === -1) {
      return clean;
    }
    if (
      clean.indexOf("firestore.googleapis.com") !== -1 ||
      clean.indexOf("googleapis.com") !== -1 ||
      clean.indexOf("omdbapi.com") !== -1 ||
      clean.indexOf("themoviedb.org") !== -1
    ) {
      return clean;
    }
    if (
      /^http:\/\//i.test(clean) ||
      clean.indexOf("player_api.php") !== -1 ||
      /\.(m3u|m3u8|ts|mp4)(\?|$)/i.test(clean) ||
      /\/(live|movie|series)\//i.test(clean)
    ) {
      return "/api/proxy?url=" + encodeURIComponent(clean);
    }
    return clean;
  }

  function sanitizeUrl(url) {
    if (!url) return "";
    var clean = String(url).trim();
    if (clean.indexOf("/api/xtream") === 0) {
      return clean.replace(/\/+$/, "");
    }
    clean = clean.replace(/^http:\/([^\/])/i, "http://$1");
    clean = clean.replace(/^https:\/([^\/])/i, "https://$1");
    clean = clean.replace(/\/+$/, "");
    if (clean && !/^https?:\/\//i.test(clean)) {
      clean = "http://" + clean;
    }
    return clean;
  }

  function getCandidates(device, config, activeDns) {
    var list = [];
    var seen = {};

    function add(url) {
      var n = sanitizeUrl(url);
      if (!n) return;
      var key = n.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        list.push(n);
      }
    }

    if (activeDns) add(activeDns);
    try {
      var storedActive = localStorage.getItem("GG_ACTIVE_DNS");
      if (storedActive) add(storedActive);
    } catch (e) {}

    if (device) {
      if (device.xtream_url) add(device.xtream_url);
      if (device.fixed_url && device.fixed_url.toLowerCase().indexOf(".m3u") === -1) add(device.fixed_url);
      if (device.dns_url && device.dns_url.toLowerCase().indexOf(".m3u") === -1) add(device.dns_url);
      if (device.xtreamUrl) add(device.xtreamUrl);
      if (device.fixedUrl && device.fixedUrl.toLowerCase().indexOf(".m3u") === -1) add(device.fixedUrl);
      if (device.dns && typeof device.dns === "string" && /^https?:\/\//i.test(device.dns)) add(device.dns);
    }

    var dnsList = [];
    if (config && Array.isArray(config.DNSs)) {
      dnsList = config.DNSs;
    } else if (config && config.fields && config.fields.DNSs && config.fields.DNSs.arrayValue && config.fields.DNSs.arrayValue.values) {
      var vals = config.fields.DNSs.arrayValue.values;
      for (var i = 0; i < vals.length; i++) {
        if (vals[i] && vals[i].stringValue) dnsList.push(vals[i].stringValue);
      }
    }

    var assignedIndex = -1;
    if (device) {
      if (device.dns !== undefined && device.dns !== null) {
        if (typeof device.dns === "object") {
          if (device.dns.integerValue !== undefined) assignedIndex = parseInt(device.dns.integerValue, 10);
          else if (device.dns.stringValue !== undefined) assignedIndex = parseInt(device.dns.stringValue, 10);
        } else {
          assignedIndex = parseInt(device.dns, 10);
        }
      }
    }
    if (!isNaN(assignedIndex) && assignedIndex >= 0 && dnsList[assignedIndex]) {
      add(dnsList[assignedIndex]);
    }

    for (var j = 0; j < dnsList.length; j++) {
      add(dnsList[j]);
    }

    add(DEFAULT_FALLBACK_DNS);

    var isHttpsPage = typeof window !== "undefined" && window.location && window.location.protocol === "https:";
    list.sort(function (a, b) {
      var aHttps = a.toLowerCase().indexOf("https://") === 0 ? 1 : 0;
      var bHttps = b.toLowerCase().indexOf("https://") === 0 ? 1 : 0;
      if (isHttpsPage) {
        return bHttps - aHttps;
      }
      return 0;
    });

    return list;
  }

  function probeServer(serverUrl, username, password, timeoutMs) {
    return new Promise(function (resolve) {
      var norm = sanitizeUrl(serverUrl);
      if (!norm) {
        resolve(null);
        return;
      }
      var testUrl =
        norm +
        "/player_api.php?username=" +
        encodeURIComponent(username || "") +
        "&password=" +
        encodeURIComponent(password || "");

      var reqUrl = wrapWithProxy(testUrl);
      var xhr = new XMLHttpRequest();
      xhr.open("GET", reqUrl, true);
      xhr.timeout = timeoutMs || 3500;
      try {
        xhr.setRequestHeader("Accept", "*/*");
      } catch (e) {}
      try {
        xhr.setRequestHeader("User-Agent", "IPTVSmartersPro");
      } catch (e) {}
      try {
        xhr.setRequestHeader("X-Requested-With", "IPTVSmartersPro");
      } catch (e) {}
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var json = JSON.parse(xhr.responseText);
              if (json && (json.user_info || json.server_info)) {
                return resolve({ server: norm, ok: true, json: json });
              }
            } catch (e) {}
          }
          resolve(null);
        }
      };
      xhr.onerror = function () { resolve(null); };
      xhr.ontimeout = function () { resolve(null); };
      try {
        xhr.send();
      } catch (e) {
        resolve(null);
      }
    });
  }

  function resolveActiveDns(options) {
    options = options || {};
    var device = options.device || {};
    var config = options.config || {};
    var username = options.username || device.username || device.xtream_username || "";
    var password = options.password || device.password || device.xtream_password || "";
    var activeDns = options.activeDns || "";

    var candidates = getCandidates(device, config, activeDns);
    if (!candidates.length) {
      return Promise.resolve(DEFAULT_FALLBACK_DNS);
    }
    if (!username || !password) {
      return Promise.resolve(candidates[0]);
    }

    var batchSize = 3;
    function testBatch(index) {
      if (index >= candidates.length) {
        var fallback = candidates[0] || DEFAULT_FALLBACK_DNS;
        return Promise.resolve(fallback);
      }
      var batch = candidates.slice(index, index + batchSize);
      var promises = [];
      for (var i = 0; i < batch.length; i++) {
        promises.push(probeServer(batch[i], username, password, 3500));
      }
      return Promise.all(promises).then(function (results) {
        for (var r = 0; r < results.length; r++) {
          if (results[r] && results[r].ok) {
            var winner = results[r].server;
            try {
              localStorage.setItem("GG_ACTIVE_DNS", winner);
            } catch (e) {}
            return winner;
          }
        }
        return testBatch(index + batchSize);
      });
    }

    return testBatch(0);
  }

  return {
    wrapWithProxy: wrapWithProxy,
    sanitizeUrl: sanitizeUrl,
    getCandidates: getCandidates,
    probeServer: probeServer,
    resolveActiveDns: resolveActiveDns,
    DEFAULT_FALLBACK_DNS: DEFAULT_FALLBACK_DNS
  };
})();

if (typeof window !== "undefined") {
  window.CryptoHelper = CryptoHelper;
  window.DnsResolver = DnsResolver;
  window.wrapWithProxy = DnsResolver.wrapWithProxy;
}
