
# Smokelyze: Advanced Spatiotemporal Analytics for Wildfire Smoke and Air Quality

Smokelyze is a cloud-native analytics platform designed to operationalize established Generalized Additive Model (GAM) frameworks for quantifying wildfire smoke impacts on regional air quality. Developed by Haebum Lee (PhD) at the Jaffe Research Group (University of Washington), this tool integrates ground-based observations with satellite-derived products to identify the smoke day and quantify the smoke contribution to air quality (O3 and PM2.5).

This project is documented as part of the "In Box: Innovations" section of the Bulletin of the American Meteorological Society (BAMS).

## Core Capabilities

- **GAM-based smoke O3 (SMO) Calculation**: Operationalizes the GAM framework **trained on non-smoke days** to quantify the smoke contribution to maximum daily 8-hour average (MDA8) O3 (Smoke O3 or SMO), proposed by Lee and Jaffe (2024a; 2024b; 2025).
- **Integrated Air Quality Monitoring**: Near Real-time fusion of **EPA AQS/AirNow PM2.5 and O3 monitoring stations** with **NOAA-HMS smoke plume polygons** to identify smoke days and calculate smoke PM2.5 and O3.
- **Transport Provenance**: Interactive **HYSPLIT backward/forward air mass trajectory simulation** to establish a reasonable relationship between wildfire sources and high observed concentrations for **Exceptional Event Demonstrations (EED)**.
- **Independent Space-borne Verification**: Direct integration of satellite-retrieved **TEMPO and TROPOMI NO2/HCHO Vertical Column Densities (VCD)** to verify volatile organic compound (VOC) wildfire emissions.
- **Collaborative Intelligence**: Geospatial site-specific commentary and empirical observations via the **MapPost** system to bridge the gap between remote sensing and localized reality.

## Technical Architecture

The platform utilizes a serverless cloud architecture optimized for high-speed statistical inference and responsive geospatial interaction:

- **Frontend**: Static site generated via **Hugo**, coupled with Vanilla JavaScript and **MapLibre GL JS** for **hardware-accelerated WebGL rendering**.
- **Backend Infrastructure**: **Google Cloud Run** orchestrated Docker containers running automated R-scripts for complex statistical calculations and data pre-processing.
- **Data Pipeline**: Serverless functions acting as a secure proxy to **Google Cloud Storage (GCS)** and real-time environmental APIs.
- **Authentication**: **Firebase Auth** for managed user sessions and collaborative metadata handling.

## Directory Structure

- `/content/map/`: Core application logic and HTML structure for the interactive map.
- `/static/js/`: Modular JavaScript engine including data loaders and map initialization.
- `/static/css/`: Design tokens and responsive layout definitions.
- `/netlify/functions/`: Node.js serverless functions for GCS data proxying.
- `/layouts/`: Hugo templates for the site architecture.

## Data Provenance and Licensing

Data analyzed within Smokelyze is curated from authoritative federal and academic sources:
- **U.S. EPA**: AQS regulatory data and AirNow observations.
- **NOAA**: HMS smoke density polygons and HYSPLIT meteorological datasets.
- **NASA (TEMPO/TROPOMI)**: High-resolution NO2 and Formaldehyde (HCHO) VCD retrievals.

## Citation

If you utilize this platform or its associated methodologies in your research, please cite the following primary paper:

- **Lee, H., & Jaffe, D. A. (2026)**. Smokelyze: A Cloud-Native Platform for Real-Time Wildfire Smoke Impact Analytics. *Bulletin of the American Meteorological Society (BAMS)*.

### Scientific Foundations (GAM Framework)

The underlying statistical methodologies and baseline calculations are based on the following peer-reviewed studies:

- **Lee, H., & Jaffe, D. A. (2025)**. Impact of wildfires on O3 and air quality across the United States for 2019–2024 using Generalized Additive Models. *Journal of Geophysical Research: Atmospheres*, 130, e2025JD044088.
- **Lee, H., & Jaffe, D. A. (2024b)**. Wildfire impacts on O3 in the continental United States using PM2.5 and a Generalized Additive Model (2018–2023). *Environmental Science & Technology*, 58, 14764–14774.
- **Lee, H., & Jaffe, D. A. (2024a)**. Impact of wildfire smoke on ozone concentrations using a Generalized Additive model in Salt Lake City, Utah, USA, 2006–2022. *Journal of the Air & Waste Management Association*, 74, 116-130.

