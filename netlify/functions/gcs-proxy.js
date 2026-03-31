
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const crypto = require("crypto");

// Initialize Firebase Admin for token verification
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.GCP_PROJECT_ID,
      clientEmail: process.env.GCP_CLIENT_EMAIL,
      private_key: (process.env.GCP_PRIVATE_KEY || "")
        .replace(/\r?\n/g, "\n")
        .replace(/\\n/g, "\n"),
    }),
  });
}

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: (process.env.GCP_PRIVATE_KEY || "")
      .replace(/\r?\n/g, "\n")
      .replace(/\\n/g, "\n"),
  },
});

const bucket = storage.bucket(process.env.GCS_BUCKET);
const DEBUG = (process.env.DEBUG_LOG || "1") === "1";

// Publicly accessible prefixes (No login required, but Origin check still applies)
const PUBLIC_PREFIXES = [
  "realtime", 
  "noaa_hms_smoke_date_geojson",
  "noaa_hms_smoke_date_json",
  "noaa_hms_smoke_year_json",
  "noaa_hms_fire_date_geojson",
  "noaa_hms_fire_date_json",
  "noaa_hms_fire_year_json",
  "modis_burn_area_date_geojson",
  "modis_burn_area_year_json",
  "airnow_date_geojson",
  "smokeday",
  "tempo_date_png",
  "tropomi_date_png"
];

function dlog(...args) { if (DEBUG) console.log.apply(console, args); }
function dwarn(...args) { if (DEBUG) console.warn.apply(console, args); }
function hostOf(u) { try { return new URL(u).host; } catch { return ""; } }

// ---- ETag-based cache revalidation ----
function generateETag(metadata) {
  return `"gcs-${metadata.generation}"`;
}

function isClientCacheValid(event, etag) {
  const inm = (event.headers || {})["if-none-match"] || "";
  if (!inm) return false;
  return inm.split(",").some(t => t.trim() === etag || t.trim() === `W/${etag}`);
}

function getCacheControl(path) {
  if (path.startsWith("realtime/")) return "public, max-age=3600, must-revalidate";
  return "public, max-age=604800, must-revalidate";
}

function checkOrigin(event) {
  const allowStr = (process.env.ALLOWED_ORIGIN || "").trim();
  const allowedOrigins = allowStr ? allowStr.split(",").map(s => s.trim()).filter(Boolean) : [];
  
  const h = event.headers || {};
  const origin = h.origin || h.Origin || "";
  const referer = h.referer || h.Referer || "";
  const originHost = origin ? hostOf(origin) : "";
  const refererHost = referer ? hostOf(referer) : "";
  const currentHost = originHost || refererHost;

  if ((event.httpMethod || "").toUpperCase() === "OPTIONS") {
    // For preflight, if any origins are allowed, use the requesting origin if it matches, else *
    const isOriginAllowed = allowedOrigins.some(ao => hostOf(ao) === originHost);
    return { ok: true, preflight: true, allow: isOriginAllowed ? origin : (allowedOrigins[0] || "*") };
  }

  if (!currentHost) {
    return { ok: false, error: "ACCESS_DENIED_HOTLINK" };
  }

  if (allowedOrigins.length > 0) {
    const isAllowed = allowedOrigins.some(ao => hostOf(ao) === currentHost);
    if (isAllowed) {
      return { ok: true, allow: origin || (allowedOrigins.find(ao => hostOf(ao) === currentHost) || allowedOrigins[0]) };
    }
    return { ok: false, error: "ACCESS_DENIED_ORIGIN_MISMATCH" };
  }

  return { ok: true, allow: "*" };
}


function safeNormalize(p) {
  try { p = decodeURIComponent(String(p)); } catch { }
  p = String(p || "").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!p || p.includes("..")) return "";
  return p;
}

function extractGcsPath(event) {
  
  const prefixes = [
    "realtime",
    "data_by_aqs",
    "data_by_aqs_meta",
    "data_by_state",
    "data_by_date",
    "modis_burn_area_date_geojson",
    "modis_burn_area_year_json",
    "noaa_hms_smoke_date_geojson",
    "noaa_hms_smoke_date_json",
    "noaa_hms_smoke_year_json",
    "noaa_hms_fire_date_geojson",
    "noaa_hms_fire_date_json",
    "noaa_hms_fire_year_json",
    "airnow_date_geojson",
    "smokeday",
    "tempo_date_png",
    "tropomi_date_png"
  ];

  let rawPath = "";
  const qs = event.queryStringParameters || {};
  if (qs.path) {
    rawPath = safeNormalize(qs.path);
  } else {
    // 1. Try direct function path
    const m = (event.path || "").match(/^\/\.netlify\/functions\/gcs-proxy\/(.+)$/);
    if (m && m[1]) {
      rawPath = safeNormalize(m[1]);
    } else {
      // 2. Try URL rewrite path
      const p = event.path || "";
      for (const pre of prefixes) {
        const re = new RegExp(`^/${pre}/(.+)$`);
        const m = p.match(re);
        if (m && m[1]) {
          rawPath = safeNormalize(`${pre}/${m[1]}`);
          break;
        }
      }
    }
  }
  
  if (!rawPath && event.path) {
    // Handle cases where the path is just the prefix (for listing)
    const p = event.path.replace(/^\/+/, "");
    for (const pre of prefixes) {
      if (p === pre || p === `${pre}/`) {
        rawPath = pre + "/";
        break;
      }
    }
  }
  
  if (!rawPath) return "";

  // FINAL SAFETY CHECK: The path MUST start with one of our valid prefixes
  const isValid = prefixes.some(pre => rawPath === pre || rawPath === pre + "/" || rawPath.startsWith(pre + "/"));
  return isValid ? rawPath : "";
}

exports.handler = async (event) => {
  const cor = checkOrigin(event);
  
  const corsHeaders = {
    "Vary": "Origin",
    "Access-Control-Allow-Origin": cor.allow,
    "Access-Control-Allow-Methods": "GET,OPTIONS,HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (cor.preflight) return { statusCode: 204, headers: corsHeaders, body: "" };
  if (!cor.ok) {
    console.warn(`[SECURITY] Hotlink Blocked: Error=${cor.error}, UserAgent=${event.headers?.['user-agent']}`);
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: cor.error }) };
  }
  
  try {
    const path = extractGcsPath(event);
    if (!path) {
      console.warn(`[SECURITY] Bad Path Attempt: QueryPath=${event.queryStringParameters?.path}, RawPath=${event.path}`);
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "bad path" }) };
    }
    
    const isPublic = PUBLIC_PREFIXES.some(pre => path.startsWith(pre + "/"));
    if (!isPublic) {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { statusCode: 401, headers: corsHeaders, body: "Login Required" };
      }
      const idToken = authHeader.split(" ")[1];
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch (authError) {
        console.error(`[SECURITY] Invalid Token Attempt: Error=${authError.message}`);
        return { statusCode: 401, headers: corsHeaders, body: "Invalid Session" };
      }
    }
    
    const qs = event.queryStringParameters || {};

    // ---- List request with ETag ----
    if (qs.list === "1") {
      const [files] = await bucket.getFiles({ prefix: path, delimiter: "/" });

      // 이렇게 하면 파일 내용이 바뀌어 generation이 변할 때 리스트의 ETag도 새롭게 갱신됩니다.
      const listInfo = files.map(f => ({
        name: f.name.replace(path, ""),
        gen: f.metadata.generation
      })).filter(i => i.name.length > 0);

      const fileNames = listInfo.map(i => i.name);
      const listBody = JSON.stringify(fileNames);

      // ETag 계산에는 파일명 + Generation 정보를 모두 포함한 listInfo를 사용합니다.
      const listEtag = `"list-${crypto.createHash("md5").update(JSON.stringify(listInfo)).digest("hex").slice(0, 16)}"`;
      const cacheControl = getCacheControl(path);

      if (isClientCacheValid(event, listEtag)) {
        dlog("[304] List unchanged (w/ Gen check):", path);
        return { statusCode: 304, headers: { ...corsHeaders, "ETag": listEtag, "Cache-Control": cacheControl }, body: "" };
      }
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "ETag": listEtag, "Cache-Control": cacheControl },
        body: listBody
      };
    }

    // ---- File request with ETag ----
    const file = bucket.file(path);
    let fileMeta;
    try {
      [fileMeta] = await file.getMetadata();
    } catch (e) {
      if (e.code === 404) {
        dwarn("[NOT_FOUND]", { path });
        return { statusCode: 404, headers: corsHeaders, body: "not found" };
      }
      throw e;
    }

    const etag = generateETag(fileMeta);
    const cacheControl = getCacheControl(path);

    // ETag match → 304 Not Modified (no download needed)
    if (isClientCacheValid(event, etag)) {
      dlog("[304] Cache valid:", path);
      return { statusCode: 304, headers: { ...corsHeaders, "ETag": etag, "Cache-Control": cacheControl }, body: "" };
    }

    // Smokeday: Signed URL redirect (file > 6MB Netlify limit)
    if (path.startsWith("smokeday/")) {
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 5 * 60 * 1000,
      });
      return { statusCode: 302, headers: { ...corsHeaders, "ETag": etag, "Cache-Control": cacheControl, "Location": url } };
    }

    // Download and serve with ETag
    const [buf] = await file.download();
    const isGzipped = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;

    const headers = {
      ...corsHeaders,
      "ETag": etag,
      "Cache-Control": cacheControl,
    };

    if (isGzipped) {
      headers["Content-Type"] = "application/json";
      headers["Content-Encoding"] = "gzip";
      return { statusCode: 200, headers, body: buf.toString("base64"), isBase64Encoded: true };
    }

    const lower = path.toLowerCase();
    if (lower.endsWith(".pbf")) {
      headers["Content-Type"] = "application/x-protobuf";
      return { statusCode: 200, headers, body: buf.toString("base64"), isBase64Encoded: true };
    }

    if (lower.endsWith(".png")) {
      headers["Content-Type"] = "image/png";
      return { statusCode: 200, headers, body: buf.toString("base64"), isBase64Encoded: true };
    }
    
    headers["Content-Type"] = "application/json; charset=utf-8";
    return { statusCode: 200, headers, body: buf.toString("utf8") };

  } catch (e) {
    console.error("[ERR]", e);
    return { statusCode: 500, headers: corsHeaders, body: "error" };
  }
};

