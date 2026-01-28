

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
    
    # --- Restore Image Collection & Processing ---
    slv_col = ee.ImageCollection("NASA/GSFC/MERRA/slv/2").filterDate(target_date_str, date_range_end)
    rad_col = ee.ImageCollection("NASA/GSFC/MERRA/rad/2").filterDate(target_date_str, date_range_end)
    
    # Process Bands
    t2max = slv_col.select("T2M").max().rename("T2MAX")
    srad = rad_col.select("SWGDN").mean().rename("SRAD")
    
    slv_vars = ["U10M", "V10M", "U500", "V500", "QV2M"]
    slv_means = slv_col.select(slv_vars).mean()
    
    combined_img = t2max.addBands(srad).addBands(slv_means)
    
    # --- ULTIMATE REPRODUCIBILITY STRATEGY: Raw Array Indexing ---
    # Instead of asking GEE to sample (which involves projection magic),
    # we download the raw 361x576 global grid and manually pick pixels
    # using the exact arithmetic formula R uses.
    
    print(f"Downloading raw MERRA-2 global grid (361x576) for {target_date_str}...")
    
    # Define Global Extent for MERRA-2
    # The raw data is typically -180 to 180, -90 to 90.
    global_geom = ee.Geometry.Rectangle([-180, -90, 180, 90], "EPSG:4326", False)
    
    # Sample the entire world as a rectangle arrays
    # This returns a dictionary of 2D arrays (values[row][col])
    raw_arrays = combined_img.sampleRectangle(region=global_geom).getInfo()["properties"]
    
    # R Raster Calculation Constants
    R_NROW = 361
    R_NCOL = 576
    R_X_RES = 0.625
    R_Y_RES = 180.0 / 361.0  # ~0.498614958
    
    def get_r_raster_value(lat, lon, band_key):
        # 1. Calculate Row (Y) Index
        # R formula: row = 1 + trunc((ymax - y) / yres) -> We use 0-based index
        # 0-based row = floor((90 - lat) / y_res)
        # Clamp to 0 ~ 360 to handle edge cases (like exactly -90)
        row_idx = int((90 - lat) / R_Y_RES)
        if row_idx >= R_NROW: row_idx = R_NROW - 1
        if row_idx < 0: row_idx = 0
            
        # 2. Calculate Col (X) Index
        # 0-based col = floor((lon - xmin) / x_res) -> xmin is -180
        col_idx = int((lon + 180) / R_X_RES)
        if col_idx >= R_NCOL: col_idx = R_NCOL - 1
        if col_idx < 0: col_idx = 0
            
        # 3. Retrieve value
        return raw_arrays[band_key][row_idx][col_idx]

    print("Extracting values using R-simulation logic...")
    
    final_features = []
    
    # Iterate through local features (no longer using GEE FeatureCollection for sampling)
    for feat in aqs_geojson["features"]:
        props = feat["properties"]
        geom = feat["geometry"]["coordinates"] # [lon, lat]
        lon, lat = geom[0], geom[1]
        
        # Attach Date
        props["date"] = target_date_str
        
        # Extract Variables
        try:
            props["T2MAX"] = get_r_raster_value(lat, lon, "T2MAX")
            props["SRAD"] = get_r_raster_value(lat, lon, "SRAD")
            props["U10M"] = get_r_raster_value(lat, lon, "U10M")
            props["V10M"] = get_r_raster_value(lat, lon, "V10M")
            props["U500"] = get_r_raster_value(lat, lon, "U500")
            props["V500"] = get_r_raster_value(lat, lon, "V500")
            props["QV2M"] = get_r_raster_value(lat, lon, "QV2M")
        except Exception as e:
            print(f"Error extracting for point {lat}, {lon}: {e}")
            # Fill with None or handle error
            pass
            
        final_features.append({
            "type": "Feature",
            "geometry": feat["geometry"],
            "properties": props
        })
        
    return {"type": "FeatureCollection", "features": final_features}

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



