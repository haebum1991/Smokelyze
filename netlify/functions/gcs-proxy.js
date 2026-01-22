
const { Storage } = require("@google-cloud/storage");
const admin = require("firebase-admin");

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
  "modis_burn_area_year_json"
];

function dlog(...args) { if (DEBUG) console.log.apply(console, args); }
function dwarn(...args) { if (DEBUG) console.warn.apply(console, args); }
function hostOf(u) { try { return new URL(u).host; } catch { return ""; } }

function checkOrigin(event) {
  const allow = (process.env.ALLOWED_ORIGIN || "").trim();
  const h = event.headers || {};
  const origin = h.origin || h.Origin || "";
  const referer = h.referer || h.Referer || "";
  const originHost = origin ? hostOf(origin) : "";
  const refererHost = referer ? hostOf(referer) : "";
  const currentHost = originHost || refererHost;

  if ((event.httpMethod || "").toUpperCase() === "OPTIONS") {
    return { ok: true, preflight: true, allow: allow || "*" };
  }

  if (!currentHost) {
    return { ok: false, error: "ACCESS_DENIED_HOTLINK" };
  }

  if (allow) {
    const allowHost = hostOf(allow);
    if (currentHost === allowHost) return { ok: true, allow };
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
  const qs = event.queryStringParameters || {};
  if (qs.path) return safeNormalize(qs.path);

  const m = (event.path || "").match(/^\/\.netlify\/functions\/gcs-proxy\/(.+)$/);
  if (m && m[1]) return safeNormalize(m[1]);

  const p = event.path || "";
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
    "noaa_hms_fire_year_json"
  ];

  for (const pre of prefixes) {
    const re = new RegExp(`^/${pre}/(.+)$`);
    const m = p.match(re);
    if (m && m[1]) {
       return safeNormalize(`${pre}/${m[1]}`);
    }
  }
  return "";
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
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: cor.error }) };
  }
  
  try {
    const path = extractGcsPath(event);
    if (!path) {
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
        return { statusCode: 401, headers: corsHeaders, body: "Invalid Session" };
      }
    }
    
    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) {
      dwarn("[NOT_FOUND]", { path });
      return { statusCode: 404, headers: corsHeaders, body: "not found" };
    }

    const [buf] = await file.download();
    const isGzipped = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;

    const headers = {
      ...corsHeaders,
      "Cache-Control": path.startsWith("realtime/")
        ? "public, max-age=3600, must-revalidate"
        : "public, max-age=2592000",
    };

    if (isGzipped) {
      headers["Content-Type"] = "application/json"; 
      headers["Content-Encoding"] = "gzip";
      
      return { 
        statusCode: 200, 
        headers, 
        body: buf.toString("base64"), 
        isBase64Encoded: true 
      };
    }

    const lower = path.toLowerCase();
    if (lower.endsWith(".pbf")) {
       headers["Content-Type"] = "application/x-protobuf";
       return { 
         statusCode: 200, 
         headers, 
         body: buf.toString("base64"), 
         isBase64Encoded: true 
       };
    }

    headers["Content-Type"] = "application/json; charset=utf-8";
    return { 
        statusCode: 200, 
        headers, 
        body: buf.toString("utf8") 
    };

  } catch (e) {
    console.error("[ERR]", e);
    return { statusCode: 500, headers: corsHeaders, body: "error" };
  }
};

