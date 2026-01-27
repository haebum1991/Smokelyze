
import ee
import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from google.cloud import storage
import gzip
import io

# --- GEE 초기화 ---
def init_gee(project_id="pmo3smoketool"):
    try:
        key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if key_path and os.path.exists(key_path):
            from google.oauth2 import service_account
            credentials = service_account.Credentials.from_service_account_file(key_path)
            scoped_credentials = credentials.with_scopes(["https://www.googleapis.com/auth/earthengine"])
            ee.Initialize(scoped_credentials, project=project_id)
        else:
            ee.Initialize(project=project_id)
        print("GEE Initialized.")
    except Exception as e:
        print(f"GEE Init Failed: {e}")
        raise e

def fetch_merra2_exact(target_date_str):
    date_start = target_date_str
    date_end = (datetime.strptime(target_date_str, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # 1. GEE 이미지 컬렉션 로드
    slv_col = ee.ImageCollection("NASA/GSFC/MERRA/slv/2").filterDate(date_start, date_end)
    rad_col = ee.ImageCollection("NASA/GSFC/MERRA/rad/2").filterDate(date_start, date_end)
    
    t2max = slv_col.select("T2M").max().rename("T2MAX")
    srad = rad_col.select("SWGDN").mean().rename("SRAD")
    slv_vars = ["U10M", "V10M", "U500", "V500", "QV2M"]
    slv_means = slv_col.select(slv_vars).mean()
    
    combined_img = t2max.addBands(srad).addBands(slv_means)
    
    # 2. 전 세계 데이터를 행렬로 다운로드 (GEE의 getRegion 사용)
    # R과 똑같은 그리드 규격 (361 x 576)
    # GEE에서 픽셀 센터들을 직접 계산해서 가져옵니다.
    print(f"Downloading MERRA-2 Grid for {target_date_str}...")
    
    # AQS 사이트 정보 로드
    with gzip.open("static/aqs_list_gam_v2.geojson.gz", "rt") as f:
        aqs_data = json.load(f)
    
    # --- R-Logic Emulation (Mathematical Indexing) ---
    # R Raster Grid Parameters
    res_x = 0.625
    res_y = 180.0 / 361.0
    
    # 각 AQS 좌표에 대해 R이 선택했을 픽셀 센터를 찾아냅니다.
    def get_r_pixel_center(lat, lon):
        row_idx = np.floor((90.0 - lat) / res_y)
        col_idx = np.floor((lon + 180.0) / res_x)
        center_lat = 90.0 - (row_idx * res_y) - (res_y / 2.0)
        center_lon = -180.0 + (col_idx * res_x) + (res_x / 2.0)
        return [center_lon, center_lat]

    # 모든 사이트를 "R이 바라보는 픽셀 중심"으로 이동시킵니다.
    shifted_points = []
    for f in aqs_data["features"]:
        coords = f["geometry"]["coordinates"]
        center_coords = get_r_pixel_center(coords[1], coords[0])
        shifted_points.append(ee.Feature(ee.Geometry.Point(center_coords), f["properties"]))
    
    sites_fc = ee.FeatureCollection(shifted_points)
    
    results = combined_img.sampleRegions(
        collection=sites_fc,
        scale=1,
        tileScale=4,
        geometries=True
    ).getInfo()
    
    # 날짜 주입 및 반환
    for feature in results["features"]:
        feature["properties"]["date"] = target_date_str
        
    return results

def upload_to_gcs(bucket_name, blob_name, data):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode="w") as f:
        f.write(json.dumps(data).encode("utf-8"))
    
    blob.upload_from_string(output.getvalue(), content_type="application/x-gzip")
    print(f"Uploaded to gs://{bucket_name}/{blob_name}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=str, default="pmo3smoketool", help="GEE Project ID")
    parser.add_argument("--date", type=str, default=(datetime.now() - timedelta(days=31)).strftime("%Y-%m-%d"), help="Target date YYYY-MM-DD")
    args = parser.parse_args()
    
    init_gee(args.project)
    
    data = fetch_merra2_exact(args.date)
    year_str = args.date[:4]
    blob_name = f"merra2_date_geojson/{year_str}/merra2_{args.date.replace('-', '')}.geojson.gz"
    upload_to_gcs("smokelyze_bucket", blob_name, data)

