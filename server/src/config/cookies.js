// Minimal cookie parser (avoids an extra dependency for a simple JWT cookie).
function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    if (k) out[k] = v;
  });
  return out;
}

function cookieMiddleware(req, res, next) {
  req.cookies = parseCookies(req.headers.cookie);
  next();
}

module.exports = { cookieMiddleware, parseCookies };
