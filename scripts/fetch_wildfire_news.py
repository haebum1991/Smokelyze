
import feedparser
import json
import os
import re
import gzip
import io
from google.cloud import storage
import urllib.parse
from datetime import datetime, timedelta, timezone

# State & Province Coords (US + Canada)
STATE_COORDS = {
    "Alabama": [32.3182, -86.9023], "Alaska": [63.5888, -154.4931], "Arizona": [34.0489, -111.0937],
    "Arkansas": [35.2010, -91.8318], "California": [36.7783, -119.4179], "Colorado": [39.5501, -105.7821],
    "Connecticut": [41.6032, -73.0877], "Delaware": [38.9108, -75.5277], "Florida": [27.6648, -81.5158],
    "Georgia": [32.1574, -82.9071], "Hawaii": [19.8968, -155.5828], "Idaho": [44.0682, -114.7420],
    "Illinois": [40.6331, -89.3985], "Indiana": [40.2672, -86.1349], "Iowa": [41.8780, -93.0977],
    "Kansas": [38.5266, -96.7265], "Kentucky": [37.8393, -84.2700], "Louisiana": [31.1260, -91.8418],
    "Maine": [45.2538, -69.4455], "Maryland": [39.0458, -76.6413], "Massachusetts": [42.4072, -71.3824],
    "Michigan": [44.3148, -85.6024], "Minnesota": [46.7296, -94.6859], "Mississippi": [32.3547, -89.3985],
    "Missouri": [37.9643, -91.8318], "Montana": [46.8797, -110.3626], "Nebraska": [41.1254, -98.2681],
    "Nevada": [38.8026, -116.4194], "New Hampshire": [43.1939, -71.5724], "New Jersey": [40.0583, -74.4057],
    "New Mexico": [34.5199, -105.8701], "New York": [40.7128, -74.0060], "North Carolina": [35.7596, -79.0193],
    "North Dakota": [47.5515, -101.0020], "Ohio": [40.4173, -82.9071], "Oklahoma": [35.0078, -97.0929],
    "Oregon": [43.8041, -120.5542], "Pennsylvania": [41.2033, -77.1945], "Rhode Island": [41.5801, -71.4774],
    "South Carolina": [33.8361, -81.1637], "South Dakota": [44.3683, -100.3510], "Tennessee": [35.5175, -86.5804],
    "Texas": [31.9686, -99.9018], "Utah": [39.3210, -111.0937], "Vermont": [44.0000, -72.7000],
    "Virginia": [37.4316, -78.6569], "Washington": [47.7511, -120.7401], "West Virginia": [38.5976, -80.4549],
    "Wisconsin": [43.7844, -88.7879], "Wyoming": [43.0760, -107.2903],
    "Alberta": [53.9333, -116.5765], "British Columbia": [53.7267, -127.6476], "Manitoba": [53.7609, -98.8139],
    "New Brunswick": [46.5653, -66.4619], "Newfoundland and Labrador": [53.1355, -60.6854],
    "Northwest Territories": [64.8255, -119.2201], "Nova Scotia": [44.6820, -63.7443], "Nunavut": [70.2998, -102.6411],
    "Ontario": [51.2538, -85.3232], "Prince Edward Island": [46.5107, -63.1311], "Quebec": [52.9399, -73.5491],
    "Saskatchewan": [52.9399, -106.4509], "Yukon": [63.6333, -135.0000]
}


def summarize_text(summary_raw):
    clean = re.sub("<[^<]+?>", ".", summary_raw)
    return clean[:300] + "..." if len(clean) > 300 else clean

def collect_news():
    # Google News RSS uses UTC (GMT). Collecting in UTC is standard and robust.
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    
    # Updated to match R script: Narrower search window (Today -1 to Today +1)
    lookup_start = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    lookup_end = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Multiple refined queries as in R script
    queries = [
        '("wildfire" OR "wildland fire" OR "forest fire" OR "bush fire" OR "brush fire" OR "vegetation fire" OR "prescribed fire")',
        '("smoke plume" OR "wildfire smoke")',
        '("canada wildfire" OR "canadian wildfire")'
    ]

    all_entries = []
    seen_links_current_run = set()

    for query in queries:
        encoded_query = urllib.parse.quote(query)
        rss_url = f"https://news.google.com/rss/search?q={encoded_query}+after:{lookup_start}+before:{lookup_end}&hl=en-US&gl=US&ceid=US:en"
        
        feed = feedparser.parse(rss_url)
        for entry in feed.entries:
            if entry.link not in seen_links_current_run:
                all_entries.append(entry)
                seen_links_current_run.add(entry.link)

    new_features = []
    
    for entry in all_entries:
        # [STRICT FILTER] Only process items from today (UTC)
        pub_dt = None
        pub_date_only = None
        if hasattr(entry, "published_parsed"):
            # Already in UTC from feed
            pub_dt = datetime(*entry.published_parsed[:6]).replace(tzinfo=timezone.utc)
            pub_date_only = pub_dt.strftime("%Y-%m-%d")
        
        # Match against UTC "today"
        if pub_date_only != today_str:
            continue

        title = entry.title
        link = entry.link
        summary_raw = entry.summary
        
        coords = {}
        state_name = None
        location_name = "Unknown"
        
        # Match by State/Province name in Title
        for name, latlong in STATE_COORDS.items():
            if name in title:
                coords = [latlong[1], latlong[0]] # [Long, Lat] for GeoJSON
                location_name = name
                state_name = name
                break
        
        
        published_display = pub_dt.strftime("%Y-%m-%d %H:%M:%S") if pub_dt else now.strftime("%Y-%m-%d %H:%M:%S")
        summary = summarize_text(summary_raw)
        
        new_features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": coords
            },
            "properties": {
                "published": published_display,
                "state": state_name,
                "location": location_name,
                "title": title,
                "summary": summary,
                "link": link
            }
        })

    if not new_features:
        print(f"[{today_str}] No new wildfire news found. Skipping GCS upload.")
        return
    
    # Save with date-based filename (Cumulative for the same day)
    
    # GCS Configuration
    bucket_name = "smokelyze_bucket"
    if not bucket_name:
        print("Error: GCS_BUCKET_NAME environment variable is not set. Please set it to your Google Cloud Storage bucket name.")
        return

    year_str = now.strftime("%Y")
    blob_name = f"realtime/wildfire_news/{year_str}/wildfire_news_{today_str}.geojson.gz"
    
    # Initialize GCS client
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
    except Exception as e:
        print(f"Error initializing GCS client: {e}")
        return

    # 1. Load existing data from GCS if exists
    existing_features = []
    if blob.exists():
        try:
            content = blob.download_as_bytes()
            # Decompress and load JSON
            with gzip.open(io.BytesIO(content), "rt", encoding="utf-8") as f:
                existing_data = json.load(f)
                existing_features = existing_data.get("features", [])
        except Exception as e:
            print(f"Reading existing GCS file failed: {e}")

    # 2. Merge new features avoiding duplicates by link
    seen_links = {f["properties"]["link"] for f in existing_features if "link" in f.get("properties", {})}
    combined_features = existing_features.copy()
    
    count_added = 0
    for nf in new_features:
        if nf["properties"]["link"] not in seen_links:
            combined_features.append(nf)
            seen_links.add(nf["properties"]["link"])
            count_added += 1

    fc = {
        "type": "FeatureCollection",
        "features": combined_features
    }
    
    # 3. Compress and Upload to GCS
    try:
        json_str = json.dumps(fc, ensure_ascii=False, indent=2)
        compressed_data = gzip.compress(json_str.encode("utf-8"))
        
        # Pass content_type directly in upload_from_string to match metadata
        blob.upload_from_string(
            compressed_data,
            content_type="application/gzip"
        )
        
        print(f"Added {count_added} new items. Total for today: {len(combined_features)} items. Uploaded to gs://{bucket_name}/{blob_name}")
    except Exception as e:
        print(f"Error uploading to GCS: {e}")

if __name__ == "__main__":
    collect_news()

