
import requests
import json
import os
import gzip
import io
from google.cloud import storage
from datetime import datetime, timedelta, timezone

def fetch_wildfire_nifc(q_date_str):
    try:
        base_url = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/ArcGIS/rest/services/WFIGS_Incident_Locations/FeatureServer/0/query"
        
        q_date = datetime.strptime(q_date_str, "%Y-%m-%d")
        next_date = q_date + timedelta(days=1)
        
        where_clause = f"FireDiscoveryDateTime >= DATE '{q_date_str}' AND FireDiscoveryDateTime < DATE '{next_date.strftime('%Y-%m-%d')}'"
        
        params = {
            "where": where_clause,
            "outFields": "IncidentName,UniqueFireIdentifier,IrwinID,IncidentTypeCategory,POOState,POOCounty,POOCity,FireDiscoveryDateTime,FireCause,DiscoveryAcres,IncidentSize,InitialLatitude,InitialLongitude",
            "f": "geojson",
            "orderByFields": "FireDiscoveryDateTime ASC"
        }
        
        response = requests.get(base_url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            features = data.get("features", [])
            
            for f in features:
                if f["properties"].get("FireDiscoveryDateTime"):
                    dt = datetime.fromtimestamp(f["properties"]["FireDiscoveryDateTime"] / 1000, tz=timezone.utc)
                    f["properties"]["FireDiscoveryDateTime"] = dt.strftime("%Y-%m-%d %H:%M:%S")
            
            return features
        else:
            print(f"Error fetching from NIFC: HTTP {response.status_code}")
            return []
    except Exception as e:
        print(f"NIFC data load failed: {e}")
        return []

def collect_nifc():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    year_str = now.strftime("%Y")
    
    bucket_name = "smokelyze_bucket"
    blob_name = f"realtime/wildfire_nifc/{year_str}/wildfire_nifc_{today_str}.geojson.gz"
    
    print(f"Collecting NIFC data for {today_str}...")
    nifc_features = fetch_wildfire_nifc(today_str)
    
    if not nifc_features:
        print(f"[{today_str}] No NIFC data found. Skipping GCS upload.")
        return

    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
    except Exception as e:
        print(f"Error initializing GCS client: {e}")
        return

    existing_features = []
    if blob.exists():
        try:
            content = blob.download_as_bytes()
            with gzip.open(io.BytesIO(content), "rt", encoding="utf-8") as f:
                existing_data = json.load(f)
                existing_features = existing_data.get("features", [])
        except Exception as e:
            print(f"Reading existing GCS file failed: {e}")

    seen_ids = {f["properties"]["UniqueFireIdentifier"] for f in existing_features if "UniqueFireIdentifier" in f.get("properties", {})}
    combined_features = existing_features.copy()
    
    count_added = 0
    for nf in nifc_features:
        fire_id = nf["properties"].get("UniqueFireIdentifier")
        if fire_id and fire_id not in seen_ids:
            combined_features.append(nf)
            seen_ids.add(fire_id)
            count_added += 1
        elif not fire_id:
            combined_features.append(nf)
            count_added += 1

    fc = {
        "type": "FeatureCollection",
        "features": combined_features
    }
    
    try:
        json_str = json.dumps(fc, ensure_ascii=False, indent=2)
        compressed_data = gzip.compress(json_str.encode("utf-8"))
        
        blob.upload_from_string(
            compressed_data,
            content_type="application/gzip"
        )
        
        print(f"Added {count_added} new NIFC items. Total for today: {len(combined_features)} items. Uploaded to gs://{bucket_name}/{blob_name}")
    except Exception as e:
        print(f"Error uploading to GCS: {e}")

if __name__ == "__main__":
    collect_nifc()

