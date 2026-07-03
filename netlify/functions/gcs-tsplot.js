
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const { PNG } = require("pngjs");
const zlib = require("zlib");

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

function hostOf(u) { try { return new URL(u).host; } catch { return ""; } }

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

function mercatorToLngLat(x, y) {
  const lon = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
  return [lon, lat];
}

// Generates an array of dates from -4 days to +4 days around target date
function get9DayWindow(dateStr) {
  const targetDate = new Date(dateStr + "T00:00:00Z");
  const dates = [];
  for (let i = -4; i <= 4; i++) {
    const d = new Date(targetDate);
    d.setUTCDate(targetDate.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
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
    console.warn(`[SECURITY] Hotlink Blocked: Error=${cor.error}, UserAgent=${event.headers?.["user-agent"]}`);
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: cor.error }) };
  }

  // 1. Authenticate Request
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { statusCode: 401, headers: corsHeaders, body: "Login Required" };
  }
  
  const idToken = authHeader.split(" ")[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (authError) {
    console.error(`[SECURITY] Invalid Token Attempt: Error=${authError.message}`);
    return { statusCode: 401, headers: corsHeaders, body: "Invalid Session" };
  }

  // 1b. Validate Role in Firestore (Allow admin & premium)
  try {
    const db = admin.firestore();
    const userSnap = await db.collection("smokelyze_users").doc(decodedToken.uid).get();
    const role = userSnap.exists ? userSnap.data().role : "";
    const allowedRoles = ["admin", "premium"];
    
    if (!allowedRoles.includes(role)) {
      console.warn(`[SECURITY] Access Blocked: Non-authorized UID ${decodedToken.uid} (role: ${role}) tried to query tsplot API!`);
      return { statusCode: 403, headers: corsHeaders, body: "Access Denied: Paid or Admin role required" };
    }
  } catch (dbError) {
    console.error(`[SECURITY] Firestore Admin/Premium check failed:`, dbError.message);
    return { statusCode: 500, headers: corsHeaders, body: "Internal Server Error" };
  }

  // 2. Parse Query Params
  const qs = event.queryStringParameters || {};
  const { date, product, aqs, dataset, metric } = qs;
  const lat = parseFloat(qs.lat);
  const lon = parseFloat(qs.lon);

  if (!date || !product) {
    return { statusCode: 400, headers: corsHeaders, body: "Missing parameters date, product" };
  }

  // 3. Check Pollutant & Mode (Daily vs Hourly)
  const isAirnowDaily = product.startsWith("airnow-daily-");
  const isTropomiDaily = product.startsWith("TROPOMI_");
  const isModelDailyVector = (dataset !== undefined && dataset !== null && dataset !== "");

  // --- CASE A2: Model/Predictions Daily (9-Day Vector Time Series: gam-v1, gam-v2, pm_cbsa, epa_ember) ---
  if (isModelDailyVector) {
    if (!aqs) {
      return { statusCode: 400, headers: corsHeaders, body: "Missing aqs parameter for Daily Vector Model Data" };
    }
    if (!metric) {
      return { statusCode: 400, headers: corsHeaders, body: "Missing metric parameter for Daily Vector Model Data" };
    }
    const dates = get9DayWindow(date);
    const results = [];

    const promises = dates.map(async (dStr) => {
      const [y] = dStr.split("-");
      const path = `data_by_date/${dataset}/${y}/data_by_date_${dStr}.geojson.gz`;

      try {
        const file = bucket.file(path);
        const [buf] = await file.download();
        const decompressed = zlib.gunzipSync(buf).toString("utf8");
        const geojson = JSON.parse(decompressed);

        if (geojson && geojson.features) {
          const feature = geojson.features.find(f => {
            const p = f.properties || {};
            return String(p.AQS || p.AQS_O3 || p.AQS_PM) === String(aqs);
          });

          if (feature && feature.properties[metric] !== undefined && feature.properties[metric] !== null) {
            const val = parseFloat(feature.properties[metric]);
            if (!isNaN(val)) {
              results.push({ date: dStr, value: val });
            }
          }
        }
      } catch (e) {
        if (e.code !== 404) {
          console.error(`[gcs-tsplot] Model daily vector load failed for ${dStr} (${dataset}):`, e.message);
        }
      }
    });

    try {
      await Promise.all(promises);
      results.sort((a, b) => new Date(a.date) - new Date(b.date));
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=86400, must-revalidate",
        },
        body: JSON.stringify(results),
      };
    } catch (err) {
      console.error("[gcs-tsplot] Process error (Model Daily Vector):", err);
      return { statusCode: 500, headers: corsHeaders, body: "Internal Server Error" };
    }
  }

  // --- CASE A: Airnow Daily (9-Day Vector Time Series) ---
  if (isAirnowDaily) {
    if (!aqs) {
      return { statusCode: 400, headers: corsHeaders, body: "Missing aqs parameter for Airnow Daily" };
    }
    const dates = get9DayWindow(date);
    const metricField = product === "airnow-daily-pm25" ? "PM2.5" : "MDA8O3";
    const results = [];

    const promises = dates.map(async (dStr) => {
      const [y] = dStr.split("-");
      const path = `airnow_date_geojson/${y}/airnow_${dStr}.geojson.gz`;

      try {
        const file = bucket.file(path);
        const [buf] = await file.download();
        const decompressed = zlib.gunzipSync(buf).toString("utf8");
        const geojson = JSON.parse(decompressed);

        if (geojson && geojson.features) {
          const feature = geojson.features.find(f => {
            const p = f.properties || {};
            return String(p.AQS || p.AQS_O3 || p.AQS_PM) === String(aqs);
          });

          if (feature && feature.properties[metricField] !== undefined && feature.properties[metricField] !== null) {
            const val = parseFloat(feature.properties[metricField]);
            if (!isNaN(val)) {
              results.push({ date: dStr, value: val });
            }
          }
        }
      } catch (e) {
        if (e.code !== 404) {
          console.error(`[gcs-tsplot] Airnow daily load failed for ${dStr}:`, e.message);
        }
      }
    });

    try {
      await Promise.all(promises);
      results.sort((a, b) => new Date(a.date) - new Date(b.date));
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=86400, must-revalidate",
        },
        body: JSON.stringify(results),
      };
    } catch (err) {
      console.error("[gcs-tsplot] Process error (Airnow Daily):", err);
      return { statusCode: 500, headers: corsHeaders, body: "Internal Server Error" };
    }
  }

  // --- CASE B: TROPOMI Daily (9-Day Raster Time Series) ---
  if (isTropomiDaily) {
    if (isNaN(lat) || isNaN(lon)) {
      return { statusCode: 400, headers: corsHeaders, body: "Missing coordinate parameters lat, lon" };
    }
    const dates = get9DayWindow(date);
    const results = [];

    const promises = dates.map(async (dStr) => {
      const [y] = dStr.split("-");
      const jsonPath = `tropomi_date_png/${product}/${y}/${product}_${dStr}.json`;
      const pngPath = `tropomi_date_png/${product}/${y}/${product}_${dStr}.png`;

      try {
        const jsonFile = bucket.file(jsonPath);
        const [jsonBuf] = await jsonFile.download();
        const metadata = JSON.parse(jsonBuf.toString("utf8"));

        let xmin, xmax, ymin, ymax;
        if (metadata.extent_file) {
          const [lonMin, latMin] = mercatorToLngLat(metadata.extent_file[0], metadata.extent_file[2]);
          const [lonMax, latMax] = mercatorToLngLat(metadata.extent_file[1], metadata.extent_file[3]);
          xmin = lonMin; xmax = lonMax; ymin = latMin; ymax = latMax;
        } else {
          const ext = metadata.extent_raw || metadata.extent;
          if (!ext) return;
          xmin = ext[0]; xmax = ext[1]; ymin = ext[2]; ymax = ext[3];
        }

        if (lon < xmin || lon > xmax || lat < ymin || lat > ymax) {
          return;
        }

        const pngFile = bucket.file(pngPath);
        const [pngBuf] = await pngFile.download();
        const png = PNG.sync.read(pngBuf);

        const xPct = (lon - xmin) / (xmax - xmin);
        const latToMercY = (l) => Math.log(Math.tan((Math.PI / 4) + (l * Math.PI / 360)));
        const mercYMin = latToMercY(ymin);
        const mercYMax = latToMercY(ymax);
        const mercYLat = latToMercY(lat);
        const yPct = (mercYMax - mercYLat) / (mercYMax - mercYMin);

        const pxX = Math.floor(xPct * png.width);
        const pxY = Math.floor(yPct * png.height);

        if (pxX >= 0 && pxX < png.width && pxY >= 0 && pxY < png.height) {
          const idx = (png.width * pxY + pxX) * 4;
          const gray = png.data[idx];
          if (gray > 0) {
            const realValue = metadata.min_val + (gray / 255) * (metadata.max_val - metadata.min_val);
            results.push({ date: dStr, value: realValue });
          }
        }
      } catch (e) {
        if (e.code !== 404) {
          console.error(`[gcs-tsplot] TROPOMI load failed for ${dStr}:`, e.message);
        }
      }
    });

    try {
      await Promise.all(promises);
      results.sort((a, b) => new Date(a.date) - new Date(b.date));
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=86400, must-revalidate",
        },
        body: JSON.stringify(results),
      };
    } catch (err) {
      console.error("[gcs-tsplot] Process error (TROPOMI):", err);
      return { statusCode: 500, headers: corsHeaders, body: "Internal Server Error" };
    }
  }

  // --- CASE C: Hourly Rasters (TEMPO, HRRR, GOES - 24-Hour Diurnal Profile) ---
  if (isNaN(lat) || isNaN(lon)) {
    return { statusCode: 400, headers: corsHeaders, body: "Missing coordinate parameters lat, lon for hourly product" };
  }

  let folder = "";
  let hours = [];

  if (product.startsWith("TEMPO_")) {
    folder = "tempo_date_png";
    hours = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22]; // Daylight hours only
  } else if (product.startsWith("COLMD_") || product.startsWith("MASSDEN_")) {
    folder = "hrrr_date_png";
    hours = Array.from({ length: 24 }, (_, i) => i);
  } else if (product.startsWith("ABI-")) {
    folder = "goes_date_png";
    hours = Array.from({ length: 24 }, (_, i) => i);
  } else {
    return { statusCode: 400, headers: corsHeaders, body: "Unsupported product type" };
  }

  const [y, m, d] = date.split("-");
  const results = [];

  const promises = hours.map(async (hour) => {
    const formattedHour = String(hour).padStart(2, "0");
    const baseName = `${product}_${date}_${formattedHour}T`;
    const jsonPath = `${folder}/${product}/${y}/${m}/${d}/${baseName}.json`;
    const pngPath = `${folder}/${product}/${y}/${m}/${d}/${baseName}.png`;

    try {
      const jsonFile = bucket.file(jsonPath);
      const [jsonBuf] = await jsonFile.download();
      const metadata = JSON.parse(jsonBuf.toString("utf8"));

      let xmin, xmax, ymin, ymax;
      if (metadata.extent_file) {
        const [lonMin, latMin] = mercatorToLngLat(metadata.extent_file[0], metadata.extent_file[2]);
        const [lonMax, latMax] = mercatorToLngLat(metadata.extent_file[1], metadata.extent_file[3]);
        xmin = lonMin; xmax = lonMax; ymin = latMin; ymax = latMax;
      } else {
        const ext = metadata.extent_raw || metadata.extent;
        if (!ext) return;
        xmin = ext[0]; xmax = ext[1]; ymin = ext[2]; ymax = ext[3];
      }

      if (lon < xmin || lon > xmax || lat < ymin || lat > ymax) {
        return;
      }

      const pngFile = bucket.file(pngPath);
      const [pngBuf] = await pngFile.download();
      const png = PNG.sync.read(pngBuf);

      const xPct = (lon - xmin) / (xmax - xmin);
      const latToMercY = (l) => Math.log(Math.tan((Math.PI / 4) + (l * Math.PI / 360)));
      const mercYMin = latToMercY(ymin);
      const mercYMax = latToMercY(ymax);
      const mercYLat = latToMercY(lat);
      const yPct = (mercYMax - mercYLat) / (mercYMax - mercYMin);

      const pxX = Math.floor(xPct * png.width);
      const pxY = Math.floor(yPct * png.height);

      if (pxX >= 0 && pxX < png.width && pxY >= 0 && pxY < png.height) {
        const idx = (png.width * pxY + pxX) * 4;
        const gray = png.data[idx];
        if (gray > 0) {
          const realValue = metadata.min_val + (gray / 255) * (metadata.max_val - metadata.min_val);
          results.push({ hour, value: realValue });
        }
      }
    } catch (e) {
      if (e.code !== 404) {
        console.error(`[gcs-tsplot] Error at hour ${hour}:`, e.message);
      }
    }
  });

  try {
    await Promise.all(promises);
    results.sort((a, b) => a.hour - b.hour);

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=86400, must-revalidate",
      },
      body: JSON.stringify(results),
    };
  } catch (err) {
    console.error("[gcs-tsplot] Process error (hourly):", err);
    return { statusCode: 500, headers: corsHeaders, body: "Internal Server Error" };
  }
};

