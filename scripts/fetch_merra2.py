
import os
import sys

# --- Windows Compatibility Patch (MUST BE AT THE VERY TOP) ---
if os.name == "nt":
    try:
        import fcntl
    except ImportError:
        from types import ModuleType
        mock_fcntl = ModuleType("fcntl")
        mock_fcntl.ioctl = lambda *args, **kwargs: None
        sys.modules["fcntl"] = mock_fcntl
        print("Note: Mocking fcntl and ioctl for Windows compatibility.")

import ee
import json
import gzip
import argparse
from datetime import datetime, timedelta
from google.cloud import storage

# ==========================================
# Configuration
# ==========================================
GCS_BUCKET_NAME = "smokelyze_bucket"
AQS_LIST_PATH = "static/aqs_list_gam_v2.geojson.gz"

def init_gee(project_id=None):
    try:
        # GitHub Actions의 gcs-key.json 경로 (GOOGLE_APPLICATION_CREDENTIALS)
        key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        
        if key_path and os.path.exists(key_path):
            print(f"Initializing GEE with Service Account: {key_path}")
            from google.oauth2 import service_account
            credentials = service_account.Credentials.from_service_account_file(key_path)
            # Earth Engine 전용 스코프 추가
            scoped_credentials = credentials.with_scopes(["https://www.googleapis.com/auth/earthengine"])
            ee.Initialize(scoped_credentials, project=project_id)
        else:
            # 로컬 환경 (개인 계정 인증용)
            if project_id:
                ee.Initialize(project=project_id)
            else:
                ee.Initialize()
        print("GEE initialized successfully.")
    except Exception as e:
        print(f"GEE Initialization Failed: {e}")
        raise e

def fetch_merra2_daily(target_date_str):
    target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
    next_date = target_date + timedelta(days=1)
    date_range_end = next_date.strftime("%Y-%m-%d")
    
    if not os.path.exists(AQS_LIST_PATH):
        raise FileNotFoundError(f"AQS list not found at {AQS_LIST_PATH}")

    with gzip.open(AQS_LIST_PATH, "rt", encoding="utf-8") as f:
        aqs_geojson = json.load(f)
    
    features = []
    for feat in aqs_geojson["features"]:
        props = feat["properties"]
        lon, lat = feat["geometry"]["coordinates"]
        features.append(ee.Feature(ee.Geometry.Point([lon, lat]), props))
    
    aqs_fc = ee.FeatureCollection(features)
    
    slv_col = ee.ImageCollection("NASA/GSFC/MERRA/slv/2").filterDate(target_date_str, date_range_end)
    rad_col = ee.ImageCollection("NASA/GSFC/MERRA/rad/2").filterDate(target_date_str, date_range_end)
    
    t2max = slv_col.select("T2M").max().rename("T2MAX")
    srad = rad_col.select("SWGDN").mean().rename("SRAD")
    
    slv_vars = ["U10M", "V10M", "U500", "V500", "QV2M"]
    slv_means = slv_col.select(slv_vars).mean()
    
    combined_img = t2max.addBands(srad).addBands(slv_means)
    
    print(f"Sampling MERRA-2 (SLV & RAD) for {target_date_str}...")
    # --- R-Compatibility Patch: Grid Misalignment Correction ---
    # The original R [raster] implementation used extent(-180, 180, -90, 90) with 361 rows,
    # which caused an edge-alignment shift. To match those values exactly:
    # We shift the sampling points by half a pixel (Lon: -0.3125, Lat: -0.25)
    
    def apply_r_shift(f):
        # Subtract half-pixel to land in the same neighborhood R [raster] package chose
        # Lon shift: 0.625 / 2 = 0.3125
        # Lat shift: 0.5 / 2 = 0.25
        coords = f.geometry().coordinates()
        new_point = ee.Geometry.Point([
            ee.Number(coords.get(0)).subtract(0.3125),
            ee.Number(coords.get(1)).subtract(0.25)
        ])
        return f.setGeometry(new_point)

    shifted_aqs = aqs_fc.map(apply_r_shift)
    
    # Sample at the shifted coordinates to match R [extract] results
    sampled_data = combined_img.sampleRegions(
        collection=shifted_aqs,
        properties=list(aqs_fc.first().propertyNames().getInfo()),
        scale=combined_img.projection().nominalScale(),
        tileScale=4,
        geometries=True  # Ensure we keep distance-shifted geometries for restoration
    )
    
    # Restore the original point geometries (shift back) for the final GeoJSON output
    def restore_geometry(f):
        coords = f.geometry().coordinates()
        return f.setGeometry(ee.Geometry.Point([
            ee.Number(coords.get(0)).add(0.3125),
            ee.Number(coords.get(1)).add(0.25)
        ]))

    results = sampled_data.map(restore_geometry)
    
    # Final cleanup: Add date to all features
    final_results = results.map(lambda f: f.set("date", target_date_str))
    
    # Fetch results
    return final_results.getInfo()

def upload_to_gcs(bucket_name, blob_name, data, content_type):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(data, content_type=content_type)
        print(f"Uploaded to gs://{bucket_name}/{blob_name}")
    except Exception as e:
        print(f"GCS Upload Error: {e}")

def process_and_upload_merra2(data, date_str):
    year_str = date_str[:4]
    for feature in data["features"]:
        feature["properties"]["date"] = date_str
    
    output_geojson = {
        "type": "FeatureCollection",
        "properties": {
            "date": date_str,
            "source": "NASA/MERRA-2 (SLV & RAD)",
            "generated_at": datetime.now().isoformat()
        },
        "features": data["features"]
    }
    
    json_str = json.dumps(output_geojson, ensure_ascii=False)
    gzip_data = gzip.compress(json_str.encode("utf-8"))
    blob_name = f"merra2_date_geojson/{year_str}/merra2_{date_str}.geojson.gz"
    upload_to_gcs(GCS_BUCKET_NAME, blob_name, gzip_data, "application/gzip")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch daily MERRA-2 data for AQS sites.")
    parser.add_argument("--date", type=str, help="Target date (YYYY-MM-DD). Default is 31 days ago.")
    parser.add_argument("--project", type=str, help="GCP Project ID for GEE initialization.")
    
    args = parser.parse_args()
    
    # Default to 31 days ago due to MERRA-2 latency
    if not args.date:
        target_dt = datetime.now() - timedelta(days=31)
        target_date_str = target_dt.strftime("%Y-%m-%d")
    else:
        target_date_str = args.date
        
    try:
        init_gee(project_id=args.project)
        data = fetch_merra2_daily(target_date_str)
        process_and_upload_merra2(data, target_date_str)
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)

