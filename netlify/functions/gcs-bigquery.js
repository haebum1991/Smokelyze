
const admin = require("firebase-admin");

// Initialize Firebase Admin for GCP token generation
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

/**
 * BigQuery N-Day Wildfire Lookback API Endpoint
 * Accepts GET query parameters:
 *  - dataset: "wildfire_inci" | "wildfire_peri"
 *  - date: "YYYY-MM-DD"
 *  - lookback: integer (default 1, min 1, max 90)
 */
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const params = event.queryStringParameters || {};
    const dataset = params.dataset || "wildfire_inci";
    const rawDate = params.date || new Date().toISOString().split("T")[0];
    const targetDate = (rawDate.toUpperCase() === "LIVE") ? new Date().toISOString().split("T")[0] : rawDate;
    const lookbackDays = Math.min(Math.max(parseInt(params.lookback || "0", 10), 0), 15);

    const projectId = process.env.GCP_PROJECT_ID || "pmo3smoketool";

    // Build table-specific partition and order columns to prevent "Unrecognized name" errors
    let tableName = "realtime_wildfire_inci";
    let partitionCol = "COALESCE(NULLIF(CAST(UniqueFireIdentifier AS STRING), ''), NULLIF(CAST(IrwinID AS STRING), ''), NULLIF(CAST(IncidentName AS STRING), ''))";
    let orderCol = "COALESCE(SAFE_CAST(ModifiedOnDateTime_dt AS TIMESTAMP), SAFE_CAST(FireDiscoveryDateTime AS TIMESTAMP))";

    if (dataset.includes("peri")) {
      tableName = "realtime_wildfire_peri";
      partitionCol = "COALESCE(NULLIF(CAST(attr_UniqueFireIdentifier AS STRING), ''), NULLIF(CAST(poly_IRWINID AS STRING), ''), NULLIF(CAST(poly_IncidentName AS STRING), ''))";
      orderCol = "COALESCE(SAFE_CAST(attr_ModifiedOnDateTime_dt AS TIMESTAMP), SAFE_CAST(attr_FireDiscoveryDateTime AS TIMESTAMP))";
    }

    // Obtain OAuth2 Access Token
    const tokenObj = await admin.credential.cert({
      projectId: process.env.GCP_PROJECT_ID,
      clientEmail: process.env.GCP_CLIENT_EMAIL,
      private_key: (process.env.GCP_PRIVATE_KEY || "")
        .replace(/\r?\n/g, "\n")
        .replace(/\\n/g, "\n"),
    }).getAccessToken();

    const accessToken = tokenObj.access_token;

    // BigQuery SQL Query with TIMESTAMP Partition Filter & Deduplication
    const query = `
      SELECT 
        ST_ASGEOJSON(SAFE.ST_GEOGFROMTEXT(geom_wkt)) AS geojson_geom,
        * EXCEPT(geom_wkt, rn)
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY ${partitionCol}
            ORDER BY ${orderCol} DESC
          ) AS rn
        FROM \`${projectId}.smokelyze_query.${tableName}\`
        WHERE date BETWEEN TIMESTAMP(DATE_SUB(DATE("${targetDate}"), INTERVAL ${lookbackDays} DAY)) 
                      AND TIMESTAMP(CONCAT("${targetDate}", " 23:59:59"))
      )
      WHERE rn = 1
    `;

    const bqResponse = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: query,
        useLegacySql: false,
        timeoutMs: 15000
      })
    });

    if (!bqResponse.ok) {
      const errText = await bqResponse.text();
      console.error("[BQ Lookback Query Failed]:", errText);
      return {
        statusCode: bqResponse.status,
        headers,
        body: JSON.stringify({ error: "BigQuery request failed", details: errText })
      };
    }

    const bqData = await bqResponse.json();

    if (!bqData.rows || bqData.rows.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type: "FeatureCollection",
          features: []
        })
      };
    }

    // Convert BigQuery rows schema to GeoJSON FeatureCollection
    const schema = bqData.schema.fields.map(f => f.name);
    const features = bqData.rows.map(row => {
      const propObj = {};
      let geojsonGeom = null;

      row.f.forEach((cell, idx) => {
        const fieldName = schema[idx];
        const val = cell.v;
        if (fieldName === "geojson_geom") {
          geojsonGeom = val;
        } else {
          propObj[fieldName] = val;
        }
      });

      let geometry = null;
      if (geojsonGeom) {
        try {
          geometry = JSON.parse(geojsonGeom);
        } catch (e) {}
      }

      if (!geometry && propObj.lon !== null && propObj.lat !== null && propObj.lon !== undefined && propObj.lat !== undefined) {
        const l1 = parseFloat(propObj.lon);
        const l2 = parseFloat(propObj.lat);
        if (!isNaN(l1) && !isNaN(l2)) {
          geometry = {
            type: "Point",
            coordinates: [l1, l2]
          };
        }
      }

      return {
        type: "Feature",
        geometry: geometry,
        properties: propObj
      };
    }).filter(f => f.geometry !== null);

    headers["Cache-Control"] = "public, max-age=300, must-revalidate";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        type: "FeatureCollection",
        features: features
      })
    };
  } catch (err) {
    console.error("[BQ Lookback Fatal Error]:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

