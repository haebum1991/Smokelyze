# Smokelyze: Advanced Spatiotemporal Analytics for Wildfire Smoke and Air Quality

Smokelyze is a cloud-native analytics platform designed to operationalize established Generalized Additive Model (GAM) frameworks for quantifying wildfire smoke impacts on regional air quality. Developed at the Jaffe Research Group (University of Washington), this tool integrates ground-based observations with satellite-derived products to identify and isolate smoke-driven pollutant enhancements.

This project is documented as part of the "In Box: Innovations" section of the Bulletin of the American Meteorological Society (BAMS).

## Core Capabilities

- **GAM-based SMO Isolation**: Operationalizes the Generalized Additive Model (GAM) to calculate a robust **"non-smoke" counterfactual baseline** based on meteorology. The difference between the observed concentration and this modeled baseline represents the **Smoke-driven enhancement (SMO)**, providing a rapid quantification for MDA8 O3 and PM2.5.
- **Integrated Air Quality Monitoring**: Real-time fusion of EPA AQS/AirNow observations with NOAA HMS smoke density polygons to provide a primary scientific basis for identifying smoke-influenced monitoring sites.
- **Transport Verification**: On-demand HYSPLIT backward trajectory simulation to verify air mass transport pathways and establish a "Clear Causal Relationship" for EPA Exceptional Event Demonstrations (EED).
- **Satellite Column Density Analysis**: Natively integrated access to TEMPO and TROPOMI retrievals (NO2, HCHO VCD) for independent, space-borne verification of concentrated wildfire emissions.
- **Collaborative Intelligence**: Geospatial site-specific commentary and empirical crowd-sourced observations via the **MapPost** system to bridge the gap between remote sensing and localized reality.

## Technical Architecture

The platform utilizes a modern, serverless stack optimized for high-speed statistical inference and interactive geospatial rendering:

- **Frontend**: Hugo (Static Site Generator) and MapLibre GL JS for hardware-accelerated WebGL rendering.
- **Backend Infrastructure**: Netlify Functions acting as a secure proxy to Google Cloud Storage (GCS) and external air quality APIs.
- **Scalable Computing**: Google Cloud Run orchestrated Docker containers for handling complex statistical calculations and data pre-processing.
- **Real-time Metadata**: Firebase Auth and Firestore for managed user sessions and collaborative geospatial markers.

## Directory Structure

- `/content/map/`: Core application logic and HTML structure for the interactive map.
- `/static/js/`: Modular JavaScript engine including data loaders and map initialization.
- `/static/css/`: Design tokens and responsive layout definitions.
- `/netlify/functions/`: Serverless functions for GCS data proxying.
- `/layouts/`: Hugo templates for the site architecture.

## Development and Reproducibility

For general usage, no installation is required as the Smokelyze platform is fully accessible via its web URL (smokelyze.org). However, for researchers who wish to reproduce the environment or verify the application's logic locally, the following setup is provided:

1. **Requirements**:
   - Hugo (Extended Version, >= 0.143.1)
   - Node.js (with npm)
   - Netlify CLI

2. **Setup**:
   ```bash
   git clone [repository-url]
   npm install
   ```

3. **Running the Site**:
   ```bash
   netlify dev
   ```

## Data Provenance and Licensing

Data analyzed within Smokelyze is curated from authoritative federal and academic sources:
- **U.S. EPA**: AQS regulatory data and AirNow real-time observations.
- **NOAA**: HMS smoke density polygons and satellite-derived plume tracking.
- **NASA (TEMPO/TROPOMI)**: High-resolution NO2 and Formaldehyde (HCHO) VCD retrievals.

### License
This software is released under the **MIT License**. See the `LICENSE` file for full legal text.

## Citation

If you utilize this platform or its associated methodologies in your research, please cite the following primary paper:

- **Lee, H., & Jaffe, D. A. (2026)**. Smokelyze: A Cloud-Native Platform for Real-Time Wildfire Smoke Impact Analytics. *Bulletin of the American Meteorological Society (BAMS)*.

### Scientific Foundations (GAM Framework)

The underlying statistical methodologies and baseline calculations are based on the following peer-reviewed studies:

- **Lee, H., & Jaffe, D. A. (2025)**. Impact of wildfires on O3 and air quality across the United States for 2019–2024 using Generalized Additive Models. *Journal of Geophysical Research: Atmospheres*, 130, e2025JD044088.
- **Lee, H., & Jaffe, D. A. (2024b)**. Wildfire impacts on O3 in the continental United States using PM2.5 and a Generalized Additive Model (2018–2023). *Environmental Science & Technology*, 58, 14764–14774.
- **Lee, H., & Jaffe, D. A. (2024a)**. Impact of wildfire smoke on ozone concentrations using a Generalized Additive model in Salt Lake City, Utah, USA, 2006–2022. *Journal of the Air & Waste Management Association*, 74, 116-130.
