
library(reticulate)
library(raster)
library(jsonlite)
library(googleCloudStorageR)
library(httr)

# --- GEE 및 GCS 설정 ---
# GitHub Actions에서는 이미 등록된 gcs-key.json을 사용합니다.
Sys.setenv(GCS_AUTH_FILE = Sys.getenv("GOOGLE_APPLICATION_CREDENTIALS"))

init_gee <- function() {
  ee <- import("ee")
  # 서비스 계정 인증 (Python 라이브러리 활용)
  key_path <- Sys.getenv("GOOGLE_APPLICATION_CREDENTIALS")
  if (key_path != "" && file.exists(key_path)) {
    auth <- import("google.oauth2.service_account")
    credentials <- auth$Credentials$from_service_account_file(key_path)
    scoped_credentials <- credentials$with_scopes(list("https://www.googleapis.com/auth/earthengine"))
    ee$Initialize(scoped_credentials, project = "pmo3smoketool")
  } else {
    ee$Initialize()
  }
  return(ee)
}

fetch_merra2_r <- function(target_date) {
  ee <- init_gee()
  
  date_start <- target_date
  date_end <- as.character(as.Date(target_date) + 1)
  
  # 1. GEE에서 이미지 컬렉션 로드
  slv_col <- ee$ImageCollection("NASA/GSFC/MERRA/slv/2")$filterDate(date_start, date_end)
  rad_col <- ee$ImageCollection("NASA/GSFC/MERRA/rad/2")$filterDate(date_start, date_end)
  
  # 2. 통계 계산 (기존 Python과 동일하게 T2MAX, SRAD 등)
  t2max <- slv_col$select("T2M")$max()$rename("T2MAX")
  srad <- rad_col$select("SWGDN")$mean()$rename("SRAD")
  slv_vars <- c("U10M", "V10M", "U500", "V500", "QV2M")
  slv_means <- slv_col$select(slv_vars)$mean()
  
  combined_img <- t2max$addBands(srad)$addBands(slv_means)
  
  # 3. GEE 데이터를 R의 Raster로 가져오기 위해 샘플링 (논문 지점들)
  # AQS 사이트 리스트 로드
  aqs_list <- jsonlite::fromJSON("static/aqs_list_gam_v2.geojson.gz", simplifyVector = FALSE)
  
  # GEE의 getRegion을 사용하여 데이터를 "raw"하게 가져옵니다.
  # 이는 NetCDF를 읽어오는 것과 유사한 효과를 줍니다.
  sites_fc <- ee$FeatureCollection(lapply(aqs_list$features, function(f) {
    props <- f$properties
    # AQS 속성 누락 방지
    if(is.null(props$AQS)) props$AQS <- props$ID 
    ee$Feature(ee$Geometry$Point(f$geometry$coordinates), props)
  }))
  
  # --- 사용자님의 R [raster] 로직 재현 ---
  # GEE에서 전체 영역을 사용자님의 361x576 그리드 데이터로 변환
  # (이 부분이 논문과 똑같이 "어긋난" 결과를 만들어내는 핵심입니다.)
  
  # 180도 범위를 361행으로 나누는 그리드 정의 (사용자님 로직)
  r_grid_transform <- list(0.625, 0, -180, 0, -(180/361), 90)
  
  combined_img_r <- combined_img$reproject(
    crs = "EPSG:4326",
    crsTransform = r_grid_transform
  )
  
  # 4. 샘플링 실행
  results <- combined_img_r$sampleRegions(
    collection = sites_fc,
    properties = list("AQS", "State", "County", "City"), # 필요한 속성들
    scale = 1, # Nearest neighbor 효과
    geometries = TRUE
  )$getInfo()
  
  # 5. 결과 가공 및 GCS 업로드
  for(i in seq_along(results$features)) {
    results$features[[i]]$properties$date <- target_date
  }
  
  # GeoJSON.gz 생성
  output_json <- jsonlite::toJSON(results, auto_unbox = TRUE)
  gz_file <- gzfile("temp_merra2.geojson.gz", "wb")
  writeBin(charToRaw(output_json), gz_file)
  close(gz_file)
  
  # GCS 업로드
  year_str <- substr(target_date, 1, 4)
  dest_path <- sprintf("merra2_date_geojson/%s/merra2_%s.geojson.gz", year_str, gsub("-", "", target_date))
  
  gcs_upload("temp_merra2.geojson.gz", 
             bucket = "smokelyze_bucket", 
             name = dest_path,
             type = "application/gzip")
  
  unlink("temp_merra2.geojson.gz")
  message("Uploaded to GCS: ", dest_path)
}

# 실행
args <- commandArgs(trailingOnly = TRUE)
target_date <- if(length(args) > 0) args[1] else as.character(Sys.Date() - 31)
fetch_merra2_r(target_date)

