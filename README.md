
# Smokelyze: Advanced Spatiotemporal Analytics for Wildfire Smoke and Air Quality

Smokelyze (`Smokelyze.org`) is an open-access, cloud-native Web analytics application designed to operationalize established Generalized Additive Model (GAM) machine learning frameworks for quantifying the impact of wildfire smoke on surface particulate matter ($\mathrm{PM_{2.5}}$) and maximum daily 8-hour average ozone ($\mathrm{MDA8 O_3}$). Developed by Haebum Lee (PhD) and Daniel A. Jaffe (PhD) at the Jaffe Research Group (University of Washington), the platform fuses ground-based regulatory observations, satellite retrievals, atmospheric transport models, and machine learning to support state/federal environmental agencies in Exceptional Event Demonstrations (EED) and aid health scientists in smoke exposure assessments.

This platform is documented as part of the *"In Box: Innovations"* section of the *Bulletin of the American Meteorological Society (BAMS)* (Lee and Jaffe, 2026).

---

## Core Capabilities

- **GAM-based Smoke $\mathrm{O_3}$ (SMO) Calculation**: Operationalizes the GAM framework **trained on non-smoke days** to quantify the smoke contribution to maximum daily 8-hour average (MDA8) $\mathrm{O_3}$ (Smoke $\mathrm{O_3}$ or SMO), proposed by Lee and Jaffe (2024a; 2024b; 2025).
- **Integrated Air Quality Monitoring**: Near Real-time fusion of **EPA AQS/AirNow $\mathrm{PM_{2.5}}$ and $\mathrm{O_3}$ monitoring stations** with **NOAA-HMS smoke plume polygons** to identify smoke days and calculate smoke $\mathrm{PM_{2.5}}$ and $\mathrm{O_3}$.
- **HYSPLIT Air Mass Trajectory & Dispersion Modeling**: Cloud-hosted **HYSPLIT backward/forward trajectory and dispersion simulations** (utilizing NAM 12-km and GDAS 1° meteorology) to establish transport pathways and plume spread between active wildfire sources and downwind exceedance receptors.
- **Space-Borne VOC & Precursor Verification**: Integration of high-resolution **NASA TEMPO** and **ESA TROPOMI** Vertical Column Densities (VCD) for nitrogen dioxide ($\mathrm{NO_2}$) and formaldehyde ($\mathrm{HCHO}$) to verify smoke plume chemistry and precursor loading.
- **HRRR & GOES Products**: Integration of NOAA **HRRR-smoke products** (Column Integrated $\mathrm{PM_{2.5}}$ / COLMD, Surface Smoke Mass Density / MASSDEN) and **GOES Aerosol Optical Depth (AOD)** to differentiate aloft smoke plumes from ground-level impacts.
- **News Aggregator & Collaborative Intelligence (MapPost)**: Automated Google News RSS feeds for localized wildfire updates, coupled with **MapPost**—a crowd-sourced geospatial annotation tool enabling registered users and researchers to log ground-level empirical observations and exchange real-time insights.

---

## Technical Architecture

The platform utilizes a serverless cloud architecture maximized for high-speed statistical inference and responsive geospatial interaction:

- **Frontend**: Static site generated via **Hugo**, coupled with Vanilla JavaScript and **MapLibre GL JS** for **hardware-accelerated WebGL rendering**.
- **Backend Infrastructure**: **Google Cloud Run** orchestrated Docker containers running automated R-scripts for complex statistical calculations and data pre-processing.
- **Data Pipeline**: Serverless functions acting as a secure proxy to **Google Cloud Storage (GCS)** and real-time environmental APIs.

---

## Directory Structure

- `/content/map/`: Core application logic, HTML viewports, and UI components for the interactive map workspace.
- `/static/js/`: Modular JavaScript engine including data loaders, MapLibre layer handlers, HYSPLIT integration, and UI state management.
- `/static/css/`: Design tokens, responsive layout definitions, and CSS styling rules.
- `/netlify/functions/`: Serverless functions acting as a secure proxy to Google Cloud Storage (GCS) assets and external APIs.
- `/layouts/`: Hugo templates for the site architecture.

---

## Data Provenance & Acknowledgments

Data analyzed within Smokelyze is curated from authoritative federal agencies and academic repositories:

- **U.S. EPA**: Air Quality System (AQS) regulatory data and AirNow real-time observations.
- **NOAA**: Hazard Mapping System (HMS) fire/smoke products, High-Resolution Rapid Refresh (HRRR-Smoke), GOES-AOD, and HYSPLIT meteorological data (NAM12 / GDAS1).
- **NASA**: TEMPO ($\mathrm{NO_2}$, $\mathrm{HCHO}$ VCD) via Langley ASDC DAAC.
- **ESA / Copernicus**: TROPOMI on Sentinel-5P ($\mathrm{NO_2}$, $\mathrm{HCHO}$ VCD) via S5P-PAL data portal.

*This work was supported by NASA Grant*

---

## License

This software is released under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the `LICENSE` file for full legal text.

---

## Citation

If you utilize the Smokelyze platform, its data products, or underlying methodologies in your research or regulatory demonstrations, please cite the primary BAMS paper:

- **Lee, H., & Jaffe, D. A. (2026)**. Smokelyze.org: Advanced Spatiotemporal Analytics for Wildfire Smoke and Air Quality. *Bulletin of the American Meteorological Society (BAMS)*.

### Primary Scientific References (GAM Framework)

- **Lee, H., & Jaffe, D. A. (2025)**. Impact of wildfires on $\mathrm{O_3}$ and air quality across the United States for 2019–2024 using Generalized Additive Models. *Journal of Geophysical Research: Atmospheres*, 130, e2025JD044088. [https://doi.org/10.1029/2025JD044088](https://doi.org/10.1029/2025JD044088)
- **Lee, H., & Jaffe, D. A. (2024b)**. Wildfire impacts on $\mathrm{O_3}$ in the continental United States using $\mathrm{PM_{2.5}}$ and a Generalized Additive Model (2018–2023). *Environmental Science & Technology*, 58, 14764–14774. [https://doi.org/10.1021/acs.est.4c05870](https://doi.org/10.1021/acs.est.4c05870)
- **Lee, H., & Jaffe, D. A. (2024a)**. Impact of wildfire smoke on ozone concentrations using a Generalized Additive model in Salt Lake City, Utah, USA, 2006–2022. *Journal of the Air & Waste Management Association*, 74, 116-130. [https://doi.org/10.1080/10962247.2023.2291197](https://doi.org/10.1080/10962247.2023.2291197)
- **Jaffe, D. A., Lee, H., Magzamen, S., Goldberg, D., & O'Dell, K. (2026)**. Health and Regulatory Impacts of $\mathrm{PM_{2.5}}$ from Wildland Fires for 2019–2024 in the U.S. *GeoHealth*, 10, e2025GH001576. [https://doi.org/10.1029/2025GH001576](https://doi.org/10.1029/2025GH001576)

