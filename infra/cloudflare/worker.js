const US_ORIGIN = "https://life-rpg-api-us.onrender.com";
const EU_ORIGIN = "https://life-rpg-api-eu.onrender.com";

function originForCountry(country) {
  const c = String(country || "").toUpperCase();

  // Prefer EU backend for Europe + nearby regions.
  if ([
    "AE", "SA", "QA", "KW", "OM", "BH",
    "TR", "IL", "EG", "JO",
    "DE", "FR", "NL", "BE", "LU", "CH", "AT",
    "IT", "ES", "PT", "IE", "GB", "SE", "NO", "DK", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "GR",
    "UA", "MD", "EE", "LV", "LT", "HR", "SI", "RS", "BA", "ME", "MK", "AL"
  ].includes(c)) {
    return EU_ORIGIN;
  }

  return US_ORIGIN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Keep health endpoint deterministic and cheap.
    if (url.pathname === "/healthz") {
      return new Response(JSON.stringify({ ok: true, edge: true }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    const country = request.cf && request.cf.country ? request.cf.country : "";
    const geoEnabled = String(env && env.ENABLE_GEO_ROUTING ? env.ENABLE_GEO_ROUTING : "0") === "1";
    const targetOrigin = geoEnabled ? originForCountry(country) : US_ORIGIN;
    const targetUrl = new URL(request.url);
    targetUrl.protocol = "https:";
    targetUrl.hostname = new URL(targetOrigin).hostname;
    targetUrl.port = "";

    const req = new Request(targetUrl.toString(), request);
    const res = await fetch(req, {
      redirect: "follow",
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      }
    });

    const out = new Response(res.body, res);
    out.headers.set("x-liferpg-origin", targetOrigin);
    out.headers.set("x-liferpg-country", country || "unknown");
    out.headers.set("x-liferpg-geo-enabled", geoEnabled ? "1" : "0");
    out.headers.set("access-control-expose-headers", "x-liferpg-origin, x-liferpg-country");
    return out;
  }
};
