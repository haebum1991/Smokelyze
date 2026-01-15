
import os
import requests
import geopandas as gpd
import pandas as pd
import json
import gzip
import io
import shutil
import zipfile
import tempfile
from datetime import datetime
from shapely.geometry import shape
from google.cloud import storage

# --- Configuration ---
GCS_BUCKET_NAME = "smokelyze_bucket"
SINU_PROJ = "+proj=sinu +lon_0=0 +x_0=0 +y_0=0 +R=6371007.181 +units=m +no_defs"
BOUNDARY_FILE = "static/map_boundaries_raw_4326.geojson.gz"

# NOAA URLs
URL_MAIN = "https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/"
URL_FIRE = URL_MAIN + "Fire_Points/Shapefile/"
URL_SMOKE = URL_MAIN + "Smoke_Polygons/Shapefile/"

# Categorization lists (to match R script logic)
CANADIAN_PROVINCES = [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", 
    "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", 
    "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"
]
NON_CONUS_STATES = ["Alaska", "Hawaii"]

from datetime import datetime, timedelta

def get_default_date():
    return datetime.now().strftime("%Y-%m-%d")

def download_file(url, target_path):
    print(f"Downloading {url}...")
    response = requests.get(url, timeout=30)
    if response.status_code == 200:
        with open(target_path, "wb") as f:
            f.write(response.content)
        return True
    else:
        print(f"Failed to download: {url} (Status: {response.status_code})")
        return False

def process_noaa_hms(target_date_str=None):
    if target_date_str is None:
        target_date_str = get_default_date()
    
    dt = datetime.strptime(target_date_str, "%Y-%m-%d")
    yymmdd = dt.strftime("%Y%m%d")
    year_str = dt.strftime("%Y")
    month_str = dt.strftime("%m")

    with tempfile.TemporaryDirectory() as tmpdir:
        fire_zip_name = f"hms_fire{yymmdd}.zip"
        smoke_zip_name = f"hms_smoke{yymmdd}.zip"
        
        fire_url = f"{URL_FIRE}{year_str}/{month_str}/{fire_zip_name}"
        smoke_url = f"{URL_SMOKE}{year_str}/{month_str}/{smoke_zip_name}"
        
        fire_zip_path = os.path.join(tmpdir, fire_zip_name)
        smoke_zip_path = os.path.join(tmpdir, smoke_zip_name)

        if not os.path.exists(BOUNDARY_FILE):
            print(f"Error: Boundary file {BOUNDARY_FILE} not found.")
            return
        
        print("Loading boundaries...")
        # Explicitly handle gzip decompression for pyogrio compatibility
        if BOUNDARY_FILE.endswith(".gz"):
            with gzip.open(BOUNDARY_FILE, "rt", encoding="utf-8") as f:
                boundaries_gdf = gpd.read_file(f)
        else:
            boundaries_gdf = gpd.read_file(BOUNDARY_FILE)
            
        boundaries_gdf = boundaries_gdf.to_crs("EPSG:4326")

        if download_file(smoke_url, smoke_zip_path):
            process_smoke_data(target_date_str, smoke_zip_path, boundaries_gdf, tmpdir)
        
        if download_file(fire_url, fire_zip_path):
            process_fire_data(target_date_str, fire_zip_path, boundaries_gdf, tmpdir)

def process_smoke_data(date_str, zip_path, boundaries_gdf, tmpdir):
    print(f"Processing smoke data for {date_str}...")
    extract_path = os.path.join(tmpdir, "smoke_extract")
    os.makedirs(extract_path, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_path)
    
    shp_files = [f for f in os.listdir(extract_path) if f.endswith(".shp")]
    if not shp_files:
        print("No .shp file found in smoke zip.")
        return

    gdf = gpd.read_file(os.path.join(extract_path, shp_files[0]))
    gdf = gdf.to_crs("EPSG:4326")
    
    if "Density" in gdf.columns:
        gdf["Density"] = gdf["Density"].fillna("light").replace("NA", "light").str.lower()
    else:
        gdf["Density"] = "light"

    gdf["geometry"] = gdf["geometry"].buffer(0)
    gdf = gdf[gdf.is_valid]

    if gdf.empty:
        print("Empty smoke data after cleaning.")
        return
    
    results_features = []
    stats_rows = []

    unique_densities = list(gdf["Density"].unique())
    processing_tasks = [("uni", gdf)] + [(d, gdf[gdf["Density"] == d]) for d in unique_densities]

    for cat_name, subset_gdf in processing_tasks:
        if subset_gdf.empty:
            continue
            
        cat_gdf = subset_gdf.dissolve()
        cat_gdf["category"] = cat_name
        
        intersection = gpd.overlay(boundaries_gdf, cat_gdf, how="intersection")
        
        if not intersection.empty:
            intersection_sinu = intersection.to_crs(SINU_PROJ)
            intersection["area_km2"] = intersection_sinu.geometry.area / 1_000_000
            
            # Aggregate stats
            for idx, row in intersection.iterrows():
                stats_rows.append({
                    "ID": row["ID"],
                    "category": cat_name,
                    "area_km2": round(row["area_km2"], 0)
                })
        
        cat_gdf = cat_gdf[["category", "geometry"]]
        results_features.append(cat_gdf)

    all_smoke_gdf = pd.concat(results_features).reset_index(drop=True)

    if stats_rows:
        df_stats = pd.DataFrame(stats_rows)
        # Ensure area_km2 is numeric for summation
        df_stats["area_km2"] = pd.to_numeric(df_stats["area_km2"], errors="coerce").fillna(0)
        
        us_mask = (~df_stats["ID"].isin(CANADIAN_PROVINCES)) & (df_stats["ID"] != "Mexico")
        us_agg = df_stats[us_mask].groupby("category")["area_km2"].sum().reset_index()
        us_agg["ID"] = "US"
        
        us_conus_mask = us_mask & (~df_stats["ID"].isin(NON_CONUS_STATES))
        us_conus_agg = df_stats[us_conus_mask].groupby("category")["area_km2"].sum().reset_index()
        us_conus_agg["ID"] = "US_conus"
        
        ca_mask = df_stats["ID"].isin(CANADIAN_PROVINCES)
        ca_agg = df_stats[ca_mask].groupby("category")["area_km2"].sum().reset_index()
        ca_agg["ID"] = "Canada"
        
        final_stats_df = pd.concat([df_stats, us_agg, us_conus_agg, ca_agg], ignore_index=True)
        final_stats_json = final_stats_df.to_dict(orient="records")
    else:
        final_stats_json = []

    year_str = date_str[:4]
    
    raw_json = json.loads(all_smoke_gdf.to_json())
    smoke_json_obj = {
        "type": raw_json.get("type", "FeatureCollection"),
        "name": f"noaa_hms_smoke_{date_str}",
        "features": raw_json.get("features", [])
    }
    for feature in smoke_json_obj["features"]:
        feature.pop("id", None)
        
    smoke_gz = gzip.compress(json.dumps(smoke_json_obj).encode("utf-8"))
    upload_to_gcs(
        GCS_BUCKET_NAME, 
        f"noaa_hms_smoke_date_geojson/{year_str}/noaa_hms_smoke_{date_str}.geojson.gz",
        smoke_gz,
        "application/gzip"
    )

    stats_str = json.dumps(final_stats_json, ensure_ascii=False)
    upload_to_gcs(
        GCS_BUCKET_NAME,
        f"noaa_hms_smoke_date_json/{year_str}/noaa_hms_smoke_{date_str}.json",
        stats_str.encode("utf-8"),
        "application/json"
    )

def process_fire_data(date_str, zip_path, boundaries_gdf, tmpdir):
    print(f"Processing fire data for {date_str}...")
    extract_path = os.path.join(tmpdir, "fire_extract")
    os.makedirs(extract_path, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_path)
    
    shp_files = [f for f in os.listdir(extract_path) if f.endswith(".shp")]
    if not shp_files:
        return
        
    gdf = gpd.read_file(os.path.join(extract_path, shp_files[0]))
    gdf = gdf.to_crs("EPSG:4326")
    
    # Standardize column names
    if "Lon" in gdf.columns and "Lat" in gdf.columns:
        gdf = gdf.rename(columns={"Lon": "lon", "Lat": "lat"})
    
    if "Time" in gdf.columns:
        date_source = gdf["Date"].astype(str) if "Date" in gdf.columns else date_str
        gdf["date"] = pd.to_datetime(
            date_source + " " + gdf["Time"].astype(str).str.zfill(4), 
            format="%Y-%m-%d %H%M", 
            errors="coerce", 
            utc=True
        )

    # 2. Coordinate adjustments and cleaning
    gdf["lon"] = gdf["lon"].round(3)
    gdf["lat"] = gdf["lat"].round(3)
    
    if "FRP" in gdf.columns:
        gdf["FRP"] = pd.to_numeric(gdf["FRP"], errors="coerce").fillna(0)
        gdf = gdf[gdf["FRP"] > 0]
    
    if gdf.empty:
        print("Empty fire data after filtering.")
        return

    agg1_keys = ["lon", "lat", "date", "Method", "Satellite", "Ecosystem"]
    present1 = [k for k in agg1_keys if k in gdf.columns]
    gdf_agg1 = gdf.groupby(present1, as_index=False).agg({"FRP": "max"})
    
    agg2_keys = ["lon", "lat", "Method", "Satellite", "Ecosystem"]
    present2 = [k for k in agg2_keys if k in gdf_agg1.columns]
    fire_pts_grouped = gdf_agg1.groupby(present2, as_index=False).agg({"FRP": "sum"})
    fire_pts_grouped["FRP"] = fire_pts_grouped["FRP"].round(1)

    fire_gdf_out = gpd.GeoDataFrame(
        fire_pts_grouped, 
        geometry=gpd.points_from_xy(fire_pts_grouped.lon, fire_pts_grouped.lat),
        crs="EPSG:4326"
    )

    fire_with_bounds = gpd.sjoin(fire_gdf_out, boundaries_gdf, how="left", predicate="within")
    
    stats_rows = []
    if not fire_with_bounds.empty:
        fire_with_bounds = fire_with_bounds.dropna(subset=["ID"])
        
        grouped = fire_with_bounds.groupby("ID").agg(
            n_fires=("FRP", "count"),
            FRP=("FRP", "sum")
        ).reset_index()
        
        grouped["n_fires"] = grouped["n_fires"].round(0)
        grouped["FRP"] = grouped["FRP"].round(1)
        
        df_grouped = grouped.copy()
        
        us_mask = (~df_grouped["ID"].isin(CANADIAN_PROVINCES)) & (df_grouped["ID"] != "Mexico")
        us_subset = df_grouped[us_mask]
        us_agg = pd.DataFrame([{
            "ID": "US",
            "n_fires": us_subset["n_fires"].sum() if not us_subset.empty else 0,
            "FRP": us_subset["FRP"].sum() if not us_subset.empty else 0
        }])
        
        us_conus_mask = us_mask & (~df_grouped["ID"].isin(NON_CONUS_STATES))
        us_conus_subset = df_grouped[us_conus_mask]
        us_conus_agg = pd.DataFrame([{
            "ID": "US_conus",
            "n_fires": us_conus_subset["n_fires"].sum() if not us_conus_subset.empty else 0,
            "FRP": us_conus_subset["FRP"].sum() if not us_conus_subset.empty else 0
        }])
        
        # Canada: In CANADIAN_PROVINCES
        ca_mask = df_grouped["ID"].isin(CANADIAN_PROVINCES)
        ca_subset = df_grouped[ca_mask]
        ca_agg = pd.DataFrame([{
            "ID": "Canada",
            "n_fires": ca_subset["n_fires"].sum() if not ca_subset.empty else 0,
            "FRP": ca_subset["FRP"].sum() if not ca_subset.empty else 0
        }])
        
        final_stats_df = pd.concat([df_grouped, us_agg, us_conus_agg, ca_agg], ignore_index=True)
        
        pd.set_option("future.no_silent_downcasting", True)
        final_stats_df["n_fires"] = pd.to_numeric(final_stats_df["n_fires"], errors="coerce").fillna(0).round(0)
        final_stats_df["FRP"] = pd.to_numeric(final_stats_df["FRP"], errors="coerce").round(1)
        
        final_stats_json = final_stats_df.dropna(subset=["ID"]).to_dict(orient="records")
    else:
        final_stats_json = []

    year_str = date_str[:4]
    
    cols_to_keep = ["Method", "Satellite", "Ecosystem", "FRP", "geometry"]
    # Filter to only keep columns that actually exist in the dataframe
    final_cols = [c for c in cols_to_keep if c in fire_gdf_out.columns]
    fire_gdf_out = fire_gdf_out[final_cols]
    
    raw_json = json.loads(fire_gdf_out.to_json())
    fire_json_obj = {
        "type": raw_json.get("type", "FeatureCollection"),
        "name": f"noaa_hms_fire_{date_str}",
        "features": raw_json.get("features", [])
    }
    for feature in fire_json_obj["features"]:
        feature.pop("id", None)
        
    fire_gz = gzip.compress(json.dumps(fire_json_obj).encode("utf-8"))
    upload_to_gcs(
        GCS_BUCKET_NAME,
        f"noaa_hms_fire_date_geojson/{year_str}/noaa_hms_fire_{date_str}.geojson.gz",
        fire_gz,
        "application/gzip"
    )
    
    fire_stats_str = json.dumps(final_stats_json, ensure_ascii=False)
    upload_to_gcs(
        GCS_BUCKET_NAME,
        f"noaa_hms_fire_date_json/{year_str}/noaa_hms_fire_{date_str}.json",
        fire_stats_str.encode("utf-8"),
        "application/json"
    )

def upload_to_gcs(bucket_name, blob_name, data, content_type):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(data, content_type=content_type)
        print(f"Uploaded to gs://{bucket_name}/{blob_name}")
    except Exception as e:
        print(f"GCS Upload Error: {e}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        process_noaa_hms(sys.argv[1])
    else:
        # Update both today and yesterday
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"Running updates for {yesterday} and {today}...")
        process_noaa_hms(yesterday)
        process_noaa_hms(today)

