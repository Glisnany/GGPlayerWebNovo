const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const zlib = require("zlib");

module.exports = async function handler(req, res) {
  // CORS Preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Extrai rawUrl de req.query ou de req.url diretamente para não truncar parâmetros com &
  let rawUrl = req.query.url;
  if (!rawUrl && req.url) {
    const m = req.url.match(/[?&]url=([^&]+.*)/);
    if (m) rawUrl = m[1];
  }

  if (!rawUrl) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  let targetUrl;
  try {
    targetUrl = decodeURIComponent(rawUrl);
    if (/^https?%3A/i.test(targetUrl)) {
      targetUrl = decodeURIComponent(targetUrl);
    }
    // Corrige typos de protocolo como http:/exemplo.com
    targetUrl = targetUrl.replace(/^http:\/([^\/])/i, "http://$1");
    targetUrl = targetUrl.replace(/^https:\/([^\/])/i, "https://$1");
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({ error: "Invalid protocol in target URL: " + targetUrl });
    }
  } catch (err) {
    return res.status(400).json({ error: "Invalid URL parameter: " + err.message });
  }

  try {
    const clientUa = req.headers["user-agent"] || "";
    const finalUa = clientUa.indexOf("IPTVSmartersPro") !== -1 ? clientUa : "IPTVSmartersPro";

    const upstreamHeaders = {
      "User-Agent": finalUa,
      "Accept": "*/*",
      "X-Requested-With": "IPTVSmartersPro"
    };

    const fetchOptions = {
      method: req.method || "GET",
      headers: upstreamHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(9000)
    };

    if (req.method === "POST" && req.body) {
      fetchOptions.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const upstreamRes = await fetch(targetUrl, fetchOptions);

    res.status(upstreamRes.status);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    const contentType = upstreamRes.headers.get("content-type") || "";
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const isM3u8 =
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegurl") ||
      /\.m3u8($|\?)/i.test(targetUrl);

    // Se for playlist HLS (.m3u8), reescreve as URLs dos segmentos para passar pelo proxy HTTPS
    if (isM3u8 && upstreamRes.status >= 200 && upstreamRes.status < 300) {
      const text = await upstreamRes.text();
      const rewritten = rewriteM3u8(text, targetUrl);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.setHeader("Content-Length", Buffer.byteLength(rewritten, "utf8"));
      return res.end(rewritten);
    }

    if (!upstreamRes.body) {
      return res.end();
    }

    const clientAcceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");
    const upstreamEncoding = upstreamRes.headers.get("content-encoding");

    // Se o upstream já mandou compactado, repassa direto
    if (upstreamEncoding) {
      res.setHeader("Content-Encoding", upstreamEncoding);
      const readable = Readable.fromWeb(upstreamRes.body);
      return await pipeline(readable, res);
    }

    // Se o cliente aceita gzip e é JSON ou texto, compacta em tempo real para nunca exceder o limite de 4.5MB da Vercel
    const isTextOrJson = !contentType || contentType.includes("json") || contentType.includes("text") || contentType.includes("javascript");
    if (clientAcceptsGzip && isTextOrJson) {
      res.setHeader("Content-Encoding", "gzip");
      const gzip = zlib.createGzip({ level: 6 });
      const readable = Readable.fromWeb(upstreamRes.body);
      return await pipeline(readable, gzip, res);
    }

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    // Pipe de streaming para chunks MPEG-TS, MP4, etc.
    const readable = Readable.fromWeb(upstreamRes.body);
    await pipeline(readable, res);
  } catch (err) {
    if (err.code === "ERR_STREAM_PREMATURE_CLOSE" || err.message === "Premature close") {
      return;
    }
    console.error("[Proxy Error] target:", targetUrl, err.name, err.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: "Proxy upstream request failed",
        type: err.name || "Error",
        message: err.message || String(err),
        url: targetUrl
      });
    }
  }
};

function rewriteM3u8(content, baseUrl) {
  const lines = content.split("\n");
  const output = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      output.push(line);
      continue;
    }

    if (trimmed.startsWith("#")) {
      if (trimmed.includes('URI="')) {
        const rewrittenTag = trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
          try {
            const absolute = new URL(uri, baseUrl).href;
            return `URI="/api/proxy?url=${encodeURIComponent(absolute)}"`;
          } catch (e) {
            return match;
          }
        });
        output.push(rewrittenTag);
      } else {
        output.push(line);
      }
      continue;
    }

    try {
      const absoluteUrl = new URL(trimmed, baseUrl).href;
      output.push(`/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
    } catch (e) {
      output.push(line);
    }
  }

  return output.join("\n");
}
