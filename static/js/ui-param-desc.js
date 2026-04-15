
import { ESML } from "./utils.js";
import { initUIPulsingIcons } from "./layers-icon.js";
import { createExportButton } from "./ui-download.js";
import { handleDownloadForLayer } from "./stats-data-export.js";

export const DescData = {
    "desc-toggle-only": [
        {
            id: "show-state-shading",
            title: "Show State Shading",
            desc: "If enabled, the states or regions are filled with colors corresponding to the selected layer values."
        },
        {
            id: "show-points",
            title: "Show Points",
            desc: "If enabled, individual monitoring station points (e.g., AQS points) are displayed on the map."
        },
        {
            id: "show-na-values",
            title: "Show N/A values",
            desc: "If enabled, regions or points with missing (N/A) values are displayed on the map."
        },
        {
            id: "map-type",
            title: "Map Type",
            desc: "Select the background map style for overlaying data. <br><ul>" +
                  "<li><b style='color: var(--card-shadow);'>Default, Light, Topo</b>: These maps use lightweight <b>Raster (PNG)</b> images. They have very low memory usage, consume minimal GPU resources, and ensure high stability on older devices.</li>" +
                  "<li><b style='color: var(--card-shadow);'>Vector</b>: This map relies on high-resolution <b>Vector Tiles</b>. It provides extremely crisp details and smooth zooming, but requires significantly higher GPU/VRAM resources to render.</li></ul>" +
                  "<br><b>Data Sources:</b><ul>" +
                  "<li><b>Default</b>: <a href='https://www.openstreetmap.org' target='_blank'>OpenStreetMap</a></li>" +
                  "<li><b>Light</b>: <a href='https://carto.com/basemaps/' target='_blank'>CARTO Light</a></li>" +
                  "<li><b>Topo</b>: <a href='https://opentopomap.org' target='_blank'>OpenTopoMap</a></li>" +
                  "<li><b>Vector</b>: 'Liberty' vector maps by <a href='https://openfreemap.org/' target='_blank'>OpenFreeMap</a></li></ul>" +
                  "<br><i>* Note</i>: If the map suddenly turns into a <b>Grey Screen</b> or fails to load, your device may have exhausted its graphics memory limit. In this case, please immediately switch the map type to <b>Default or Light</b> to restore stability."
        },
        {
            id: "InputHysplitDuration",
            title: "Duration (hr)",
            desc: "The duration (in hours) to run the simulation. This value represents the simulation period for both <b>Backward (BWD)</b> and <b>Forward (FWD)</b> modes."
        },
        {
            id: "InputHysplitHeight",
            title: "Height (AGL) (m)",
            desc: "The height above ground level (AGL) in meters. <br><ul>" +
                "<li>For <b>Trajectory</b>: It defines the receptor site's height of interest.</li>" +
                "<li>For <b>Dispersion</b>: It represents the source release height from emission sources something like that. In HYSPLIT READY, this is equivalent to the <b>Release Top</b> parameter.</li></ul>"
        },
        {
            id: "InputHysplitRate",
            title: "Release Rate (kg hr-1)",
            desc: "Rate of mass emission of the pollutant per hour. <br><i>* Note</i>: In HYSPLIT READY, this is equivalent to the <b>Release Quantity (kg)</b> divided by the <b>Release Duration (hr)</b>."
        },
        {
            id: "InputHysplitReleaseDuration",
            title: "Release Duration (hr)",
            desc: "The release duration (in hours) that the pollutant is emitted from the source. In HYSPLIT READY, this corresponds to the <b>Release Duration (hr)</b> parameter."
        },
        {
            id: "InputHysplitPdiam",
            title: "Particle Diameter (μm)",
            desc: "The aerodynamic diameter of the pollutant particles. <b>This is a key parameter for calculating gravitational settling (dry deposition)</b>."
        },
        {
            id: "InputHysplitPdensity",
            title: "Particle Density (g cm-3)",
            desc: "The density of the pollutant particles. <b>Used for calculating gravitational settling (dry deposition)</b>."
        }
    ],
    "desc-drawer-only": [
        { 
            id: "wildfire-news",
            title: "Wildfire News", 
            desc: "<b style='color: var(--card-shadow);'>Wildfire News</b> are automatically retrieved from Google News based on <b style='color: var(--card-shadow);'>UTC time</b>. " +
                  "The system monitors key terms such as <em>'wildfire'</em>, <em>'smoke plume'</em>, <em>'forest fire'</em>, etc. to provide the latest updates. " +
                  "Since precise incident coordinates are rarely available in news feeds, articles are assigned to <b style='color: var(--card-shadow);'>representative state-level locations</b>. " +
                  "To ensure visibility when multiple articles share the same state, a <b style='color: var(--card-shadow);'>small random jitter</b> is applied to prevent markers from overlapping. " +
                  "All collected articles are consolidated in the <b style='color: var(--card-shadow);'>side drawer</b> for easy browsing, ensuring that news across all regions can be accessed regardless of map localization." +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Every 6 hours</b> (at 0, 6, 12, 18 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2018-01-01. </b>" +
                  "The data is collected every 6 hours and the map is updated accordingly. </li>" +
                  "<li>Depending on the keywords used for collection, irrelevant news articles may be included in the results.</li></ul>"
        },
        {
            id: "MapPost",
            title: "MapPost",
            desc: "<b style='color: var(--card-shadow);'>MapPost</b> is a community-driven feature that allows users to share insights, opinions, and observations directly on the map. " +
                  "Users can pin a location and add a title and detailed content. " +
                  "Other members can also reply to MapPost to foster discussion. " +
                  "To add a MapPost, toggle the MapPost layer and click [+MapPost] button (or Right-click on the map)." +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Real-time</b></li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is managed in real-time. </b>" +
                  "Only registered users can create or reply to MapPost. </li></ul>"
        },
        {
            id: "HysplitSim",
            title: "HYSPLIT Simulation",
            desc: "<b style='color: var(--card-shadow);'>HYSPLIT (Hybrid Single-Particle Lagrangian Integrated Trajectory)</b> is a model for computing air mass trajectories, as well as complex transport, and dispersion. <br><br>" +
                "In our application, you can execute <b>Forward/Backward Trajectories</b> and <b>Dispersion Simulations</b> based on NAM12 meteorological data (for values outside the specified range, GDAS1 is used). " +
                "<ul><li><b>Trajectory</b>: Tracks the movement of an air mass over time. Useful for finding the source or destination of a smoke plume.</li>" +
                "<li><b>Dispersion</b>: Simulates the spread and concentration of pollutants over time, including physical effects like <b>Gravitational Settling</b>.</li></ul>" +
                "Official page: <a href='https://www.ready.noaa.gov/HYSPLIT.php' target='_blank'>NOAA READY HYSPLIT</a>"
        },
        { 
            id: "fig-table",
            title: "Statistical Data Table",
            desc: "Displays a comprehensive tabular view of daily or annual metrics across regions and monitoring sites. " +
                  "<br><ul><li><b>Drill-down</b>: Click on a region or state name to explore site-level statistics for that area.</li>" +
                  "<li><b>Data Export</b>: Download the currently displayed results as a .CSV file for local analysis in Excel or other tools.</li>" +
                  "<li><b>Metric Grouping</b>: Selected layers are automatically grouped by source (e.g., GAM v2 vs. AirNow) for clarity.</li></ul>"
        },
        { 
            id: "fig-barline",
            title: "Bar & Line Layout",
            desc: "Visualizes trends and comparisons using an interactive bar and line chart interface. " +
                  "<br><ul><li><b>Multi-Axis Comparison</b>: Supports multiple vertical axes to simultaneously compare different data types (e.g., O3 concentrations vs. TMAX).</li>" +
                  "<li><b>Exceedance Monitoring</b>: Highlights exceedance days (> 70 ppb) with specific color coding for smoke-impacted vs. non-smoke cases.</li>" +
                  "<li><b>Interactive Drill-down</b>: Click on labels to switch between national/state overview and site-specific details.</li></ul>"
        },
        { 
            id: "fig-parcoords",
            title: "Parallel Coordinates Plot",
            desc: "A powerful multidimensional visualization tool for identifying correlations across multiple variables. " +
                  "<br><ul><li><b>Relationship Analysis</b>: Map each selected metric (O3, PM2.5, SRAD, etc.) to a vertical axis to observe multivariate trends.</li>" +
                  "<li><b>Dynamic Filtering</b>: The order and number of axes are determined by the order in which you select data layers in the sidebar.</li>" +
                  "<li><b>Geospatial Link</b>: Clicking on site-specific lines or labels will locate and highlight them on the main map.</li></ul>"
        },
        { 
            id: "fig-scatter",
            title: "Scatter Plot Analysis",
            desc: "Directly compares two or more variables to evaluate model performance and identify data correlations. " +
                  "<br><ul><li><b>Model Performance</b>: Includes a 1:1 reference line to assess how well predicted values align with observations.</li>" +
                  "<li><b>Smoke Categorization</b>: Automatically classifies points into Smoke Days (SMD) and Non-Smoke Days (NSD) based on HMS and PM2.5 criteria.</li>" +
                  "<li><b>Interactive Mapping</b>: Selecting data points highlights the corresponding monitoring site on the map, facilitating detailed inspection.</li></ul>"
        },
        {
            id: "fig-heatmap",
            title: "Annual Heatmap Analysis",
            desc: "Provides a seasonal overview of satellite-derived and model data using a color-coded grid. " +
                  "<br><ul><li><b>Temporal Trends</b>: Easily observe how metrics like area burned or smoke density change month-to-month throughout the year.</li>" +
                  "<li><b>Spatial Comparison</b>: Compare intensity across different states or regions in a single unified view.</li>" +
                  "<li><b>Data Focus</b>: Optimized for Satellite (HMS, MODIS) and long-term analysis datasets.</li></ul>"
        }
    ],
    "desc-nifc": [
        {
            id: "wildfire-nifc",
            title: "WF incident locations",
            desc: "<b style='color: var(--card-shadow);'>Wildfire (WF) incident locations </b> are retrieved from the " + 
                  "<b style='color: var(--card-shadow);'>NIFC (National Interagency Fire Center) WFIGS (Wildland Fire Interagency Geospatial Services)</b>. " + 
                  "This dataset provides verified information on wildland fire occurrences based on " + 
                  "<b style='color: var(--card-shadow);'>UTC time</b>, " + 
                  "including <em>incident name</em>, <em>fire cause</em>, and <em>burn area (acres)</em>. " +
                  "This data includes <b style='color: var(--card-shadow);'>precise discovery coordinates</b> as reported by fire management agencies via the Integrated Reporting of Wildland-Fire Information (IRWIN). " +
                  "The system captures a wide range of incident types and categories, ensuring a comprehensive overview of fire events across the region." +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Every 6 hours</b> (at 0, 6, 12, 18 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2018-01-01. </b>" +
                  "The data is collected every 6 hours and the map is updated accordingly. </li></ul>"
        }
    ],
    "desc-airnow": [
        {
            id: "airnow-daily-mda8",
            title: "Obs MDA8",
            desc: "<b>Obs MDA8</b> provides the maximum daily 8-hour average ozone concentrations from the US EPA AirNow network. " +
                  "MDA8 is the primary metric used for ozone air quality standards and health assessments. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Daily</b> (at 9 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2018-07-18. </b></li>" +
                  "<li>Typically has a <b style='color: var(--card-shadow);'>1-day reporting delay</b> from the current date.</li></ul>"
        },
        {
            id: "airnow-daily-pm25",
            title: "Obs PM2.5",
            desc: "<b>Obs PM2.5</b> provides 24-hour averaged fine particulate matter concentrations from the US EPA AirNow network. " +
                  "This daily data is useful for assessing longer-term air quality trends and compliance with daily air quality standards. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Daily</b> (at 9 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2018-07-18. </b></li>" +
                  "<li>Typically has a <b style='color: var(--card-shadow);'>1-day reporting delay</b> from the current date.</li></ul>"
        },
        {
            id: "airnow-hourly-ozone",
            title: "Obs O3 (hourly)",
            desc: "<b>Obs O3 (hourly)</b> provides real-time hourly ground-level ozone (O3) concentrations from the US EPA AirNow network. " +
                  "Ground-level ozone is formed by chemical reactions between pollutants and sunlight, often exacerbated by wildfire emissions. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Every 6 hours</b> (at 3, 9, 15, 21 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2019-07-01. </b></li>" +
                  "<li>Typically has up to a <b style='color: var(--card-shadow);'>6-hr reporting delay</b> from the current local time.</li></ul>"
        },
        {
            id: "airnow-hourly-pm25",
            title: "Obs PM2.5 (hourly)",
            desc: "<b>Obs PM2.5 (hourly)</b> provides real-time hourly fine particulate matter (PM2.5) concentrations from the US EPA AirNow network. " +
                  "This data is crucial for identifying immediate smoke impacts and tracking air quality trends as they happen. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Every 6 hours</b> (at 3, 9, 15, 21 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2019-07-01. </b></li>" +
                  "<li>Typically has up to a <b style='color: var(--card-shadow);'>6-hr reporting delay</b> from the current local time.</li></ul>"
        },
        {
            id: "airnow-hourly-no2",
            title: "Obs NO2 (hourly)",
            desc: "<b>Obs NO2 (hourly)</b> provides real-time hourly nitrogen dioxide (NO2) concentrations from the US EPA AirNow network. " +
                  "NO2 is a primary pollutant from combustion sources and is a key precursor to ozone and secondary particulate matter formation. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Every 6 hours</b> (at 3, 9, 15, 21 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2019-07-01. </b></li>" +
                  "<li>Typically has up to a <b style='color: var(--card-shadow);'>6-hr reporting delay</b> from the current local time.</li></ul>"
        }
    ],
    "desc-satellite": [
        {
          id: "smoke",
          title: "HMS-smoke",
          desc: "<b>NOAA-HMS Smoke Plumes</b> are satellite-derived products highlighting areas of overhead smoke. " +
                "Statistical summaries represent the coverage area (km²) within administrative boundaries. " +
                "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Twice Daily</b> (at 13, 18 UTC)</li>" +
                "<li>In our app, <b style='color: var(--card-shadow);'>" +
                "this data is available starting from 2018-01-01. </b>" +
                "Due to the NOAA HMS processing cycle, " +
                "Finalized data are typically published at 11:00-13:00 UTC on the following day, " +
                "and current preliminary data are published at 16:00-18:00 UTC on the current day. </li></ul>"
        },
        {
          id: "fire",
          title: "HMS-fire",
          desc: "<b>NOAA-HMS Fire Points</b> represent thermal anomalies and Fire Radiative Power (FRP). " +
                "The points are <b style='color: var(--card-shadow);'>spatially aggregated at 0.001 degree (~ 0.1 km) resolution</b> to ensure clarity and prevent overlapping markers. " +
                "And then, the <b style='color: var(--card-shadow);'>regional statistics</b> (fire points and FRP) are computed. " +
                "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Twice Daily</b> (at 13, 18 UTC)</li>" +
                "<li>In our app, <b style='color: var(--card-shadow);'>" +
                "this data is available starting from 2018-01-01. </b>" + 
                "Due to the NOAA HMS processing cycle, " +
                "Finalized data are typically published at 11:00-13:00 UTC on the following day, " +
                "and current preliminary data are published at 16:00-18:00 UTC on the current day. </li></ul>"
        },
        {
          id: "burn",
          title: "MODIS area burned",
          desc: "<b>MODIS Burned Area (MCD64A1)</b> identifies the historical footprint of fire-impacted terrain. " +
                "This 500m resolution dataset highlights monthly changes in surface reflectance associated with burning. " +
                "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Manual/On-demand</b></li>" +
                "<li>In our app, <b style='color: var(--card-shadow);'>" +
                "this data is available starting from 2018-01-01, </b>" + 
                "and is updated on an as-available basis. </li></ul>"
        },
        {
            id: "tempo-no2",
            title: "TEMPO-NO2-L3 (hourly)",
            desc: "<b>TEMPO NO2VCD L3 (hourly)</b> provides high-resolution tropospheric vertical column density (VCD) of nitrogen dioxide (NO<sub>2</sub>) from NASA's geostationary TEMPO satellite. " +
                  "Data is strictly filtered using the official <em>Main Quality Flag (0)</em> and a <em>Cloud Fraction threshold (< 10%)</em> to ensure high-accuracy, clear-sky observations. " +
                  "It allows for near real-time tracking of nitrogen dioxide levels over North America in unit of 10<sup>14</sup> molecules/cm<sup>2</sup>. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Daily</b> (at 9 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2023-08-02, </b>" + 
                  "and, <b style='color: var(--card-shadow);'>spatially aggregated to 0.04&deg; (~ 4.4 km)</b> for visualization performance.</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1. </li></ul>"
        },
        {
            id: "tempo-hcho",
            title: "TEMPO-HCHO-L3 (hourly)",
            desc: "<b>TEMPO HCHOVCD L3 (hourly)</b> provides high-resolution vertical column density (VCD) of formaldehyde (HCHO) from NASA's geostationary TEMPO satellite. " +
                  "Data is strictly filtered using the official <em>Main Quality Flag (0)</em> and a <em>Cloud Fraction threshold (< 10%)</em> to ensure high-accuracy, clear-sky observations. " +
                  "It allows for near real-time tracking of formaldehyde levels over North America in unit of 10<sup>14</sup> molecules/cm<sup>2</sup>. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Daily</b> (at 9 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2023-08-02, </b>" + 
                  "and, <b style='color: var(--card-shadow);'>spatially aggregated to 0.04&deg; (~ 4.4 km)</b> for visualization performance.</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1. </li></ul>"
        },
        {
            id: "tropomi-no2",
            title: "TROPOMI-NO2-L3",
            desc: "<b>TROPOMI NO2VCD L3</b> maps are based on <b>Collection 3 of the Sentinel-5P Nitrogen Dioxide Level-2 products</b> (L2__NO2___) from the Copernicus Data Space Ecosystem. " +
                  "Data is strictly filtered according to the official recommendation (<b>QA value > 0.75</b>) to ensure high-accuracy, clear-sky observations. " +
                  "The measurements are mapped on a fixed grid and processed into Level-3 data by <b>S5P-PAL</b>, providing tropospheric vertical column density (VCD) in units of 10<sup>14</sup> molecules/cm<sup>2</sup>. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Daily</b> (at 9 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2018-05-01. </b>" +
                  "and, <b style='color: var(--card-shadow);'>spatially aggregated to 0.044&deg; (~ 5 km)</b> for visualization performance.</li>" +
                  "<li>Map Portal: <a href='https://maps.s5p-pal.com/no2-tropospheric/' target='_blank'>S5P-PAL NO2 Map</a></li>" +
                  "<li>Due to the S5P-PAL data processing cycle, the most recent dataset is available with <b style='color: var(--card-shadow);'>approximately 2-week latency</b>.</li></ul>"
        },
        {
            id: "tropomi-hcho",
            title: "TROPOMI-HCHO-L3",
            desc: "<b>TROPOMI HCHOVCD L3</b> maps are based on <b>Collection 3 of the Sentinel-5P Formaldehyde Level-2 products</b> (L2__HCHO__) from the Copernicus Dataspace Browser. " +
                  "Data is strictly filtered according to the official recommendation (<b>QA Value > 0.5</b>) to ensure high-accuracy, clear-sky observations. " +
                  "The measurements are mapped on a fixed grid and processed into Level-3 data by <b>S5P-PAL</b>, tracking formaldehyde levels over North America in units of 10<sup>14</sup> molecules/cm<sup>2</sup>. " +
                  "<br><ul><li>Update cycle: <b style='color: var(--card-shadow);'>Daily</b> (at 9 UTC)</li>" +
                  "<li>In our app, <b style='color: var(--card-shadow);'>" +
                  "this data is available starting from 2018-05-07. </b>" +
                  "and, <b style='color: var(--card-shadow);'>spatially aggregated to 0.044&deg; (~ 5 km)</b> for visualization performance.</li>" +
                  "<li>Map Portal: <a href='https://maps.s5p-pal.com/hcho/' target='_blank'>S5P-PAL HCHO Map</a></li>" +
                  "<li>Due to the S5P-PAL data processing cycle, the most recent dataset is available with <b style='color: var(--card-shadow);'>approximately 2-week latency</b>.</li></ul>"
        }
    ],
    "desc-published-intro": [
        {
            id: "general-info",
            title: "General information",
            desc: "The detailed information is provided in the tooltip, and please see the [Parameter descriptions] for each dataset. " +
                  "We recommend using the most recent (highest) version for each analysis." +
                  "<ul><li><b style='color: var(--card-shadow);'>[UW GAM-v2]</b> includes smoke days, smoke PM2.5 and smoke O3 for the ozone season (<b>April-Oct, 2019-2024</b>).</li>" +
                  "<li><b style='color: var(--card-shadow);'>[UW GAM-v1]</b> includes smoke days, smoke PM2.5 and smoke O3 for the ozone season (<b>May-Sep, 2018-2023</b>).</li>" +
                  "<li><b style='color: var(--card-shadow);'>[UW Smoke PM2.5]</b> includes smoke days and smoke PM2.5 for the full year (<b>2019-2024</b>).</li>" +
                  "<br>" +
                  "<li><b style='color: var(--card-shadow);'>[UW GAM-v2 (2025+)]</b> includes smoke days, smoke PM2.5 and smoke O3 for the ozone season (<b>April-Oct, 2025+</b>).</li>" +
                  "<li><b style='color: var(--card-shadow);'>[UW Smoke PM2.5 (2025+)]</b> includes smoke days and smoke PM2.5 for the full year (<b>2025+</b>).</li></ul>"
        },
        {
            id: "purpose",
            title: "What is the [Published] data for?",
            desc: "The [Published] data tab allows users to explore and understand previously developed GAMs for O3 prediction and related air quality analyses. " + 
                  "It provides an overview of different versions of GAMs, " + 
                  "including historical versions such as <b>UW GAM-v1 </b>" +
                  "(<a href='https://doi.org/10.1021/acs.est.4c05870' target='_blank'>Lee and Jaffe, 2024</a>), " +
                  "as well as newer models like <b>UW GAM-v2 </b>" + 
                  "(<a href='https://doi.org/10.1029/2025JD044088' target='_blank'>Lee and Jaffe, 2025</a>). " +
                  "In the [Overview] tab, users can view model metadata, compare different model outputs, " + 
                  "and examine time-series and scatter plots of observed versus predicted values for selected sites. " + 
                  "In the [Layer map] tab, users can load data for analysis and customize data visualization by choosing point, raster, or HMS layers. " + 
                  "This functionality helps users assess the performance of various GAM models and compare different approaches to understanding air quality dynamics, particularly in the context of wildfires."
        },
        {
            id: "purpose-prediction",
            title: "What is the [Latest Analysis & Prediction] for?",
            desc: "The [Latest Analysis & Prediction] section provides continuous monitoring and near real-time predictions of wildfire impacts for the 2025 season and beyond. " +
                  "While the [Published] datasets are based on finalized historical records, these predictions utilize validated model parameters from our research (e.g., <b>UW GAM-v2</b>) but integrate preliminary seasonal data to provide current situational awareness. " +
                  "This allows users to track ongoing smoke impacts as they occur using the same frameworks established in our peer-reviewed research." +
                  "<br><ul><li><b style='color: var(--card-shadow);'>[UW GAM-v2 (2025+)]</b> includes smoke days, smoke PM2.5 and smoke O3 for the ozone season (April-Oct). " +
                  "Due to the update cycle of predictors used in GAM estimation, the most recent data is approximately <b>8-9 weeks old</b>. " +
                  "Based on the EPA data finalization cycle, a full re-analysis of the previous year (e.g., 2025) is typically conducted during Q3-Q4 of the current year (e.g., 2026), and data may be updated accordingly.</li>" +
                  "<li><b style='color: var(--card-shadow);'>[UW Smoke PM2.5 (2025+)]</b> includes smoke days and smoke PM2.5 for the full year. " +
                  "The most recent data is uploaded with a delay of approximately <b>2-3 days</b>. " +
                  "Based on the EPA data finalization cycle, a full re-analysis of the previous year (e.g., 2025) is typically conducted during Q3-Q4 of the current year (e.g., 2026), and data may be updated accordingly.</li></ul>"
        },
        {
            id: "research-o3-gam",
            title: "Research for smoke contribution to O3 using GAM in the US",
            desc: "<ul><li><b style='color: var(--card-shadow);'>[UW GAM-v2]</b>, data period: Apr to Oct, 2019-2024, study area: CONUS + AK + HI<ul>" +
                  "<li>EPA data for O3 and PM2.5 (pre-generated data) were downloaded as of 2024-11-19.</li>" +
                  "<li>Lee, H. and Jaffe, D. A.: " +
                  "Impact of Wildfires on O3 and Air Quality Across the United States for 2019–2024 Using Generalized Additive Models, " +
                  "J. Geophys. Res. Atmos., 130, e2025JD044088, 2025. " +
                  "<a href='https://doi.org/10.1029/2025JD044088' target='_blank'>https://doi.org/10.1029/2025JD044088</a></li></ul></li>" +
                  
                  "<li><b style='color: var(--card-shadow);'>[UW GAM-v1]</b>, data period: May to Sep, 2018-2023, study area: CONUS<ul>" +
                  "<li>EPA data for O3 and PM2.5 (pre-generated data) were downloaded as of 2023-10-26.</li>" +
                  "<li>Lee, H. and Jaffe, D. A.: " + 
                  "Wildfire impacts on O3 in the continental United States using PM2.5 and a generalized additive model (2018–2023), " +
                  "Environ. Sci. Technol., 58, 14764–14774, 2024. " +
                  "<a href='https://doi.org/10.1021/acs.est.4c05870' target='_blank'>https://doi.org/10.1021/acs.est.4c05870</a></li></ul></li></ul>"
        },
        {
            id: "research-pm25-gam",
            title: "Research for smoke contribution to PM2.5 in the US",
            desc: "<ul><li><b style='color: var(--card-shadow);'>[UW Smoke PM2.5]</b>, data period: Jan to Dec, 2019-2024, study area: CONUS + AK + HI<ul>" +
                  "<li>EPA data for O3 and PM2.5 (pre-generated data) were downloaded as of 2024-11-19.</li>" +
                  "<li>Jaffe, D., Lee, H., Magzamen, S., Goldberg, D., and O'Dell, K.: " + 
                  "Health and Regulatory Impacts of PM2.5 from Wildland Fires for 2019–2024 in the U.S., " +
                  "GeoHealth, Under review, 2025. " + 
                  "<a href='' target='_blank'></a></li></ul></li></ul>"
        },
        {
            id: "research-o3-ember",
            title: "Research for smoke contribution to O3 using EMBER in the US",
            desc: "<ul><li><b style='color: var(--card-shadow);'>[EPA EMBER]</b>, data period: Apr to Sep, 2023, study area: CONUS<ul>" +
                  "<li>Simon, H. Beidler, J., Baker, K. R., Henderson, B. H., Fox, L., Misenis, C., Campbell, P., Vukovich, J., Possiel, N., and Eyth, A.: " +
                  "Expedited modeling of burn events results (EMBER): A screening-level dataset of 2023 ozone fire impacts in the US, " + 
                  "Data in Brief, 58, 111208, 2024. " +
                  "<a href='https://doi.org/10.1016/j.dib.2024.111208' target='_blank'>https://doi.org/10.1016/j.dib.2024.111208</a></li></ul></li></ul>"
        }
    ],
    "desc-published-gam-v2": [
        {
            id: "citation",
            title: "Citation",
            desc: "Lee, H. and Jaffe, D. A.: " +
                  "Impact of Wildfires on O3 and Air Quality Across the United States for 2019–2024 Using Generalized Additive Models, " +
                  "<em>J. Geophys. Res.: Atmos.</em>, 130, e2025JD044088, 2025. " +
                  "<a href='https://doi.org/10.1029/2025JD044088' target='_blank'>https://doi.org/10.1029/2025JD044088</a>"
        },
        { id: "mda8-obs", title: "Obs MDA8", desc: "Daily maximum 8-hour average O3 concentration (MDA8) observed at AQS monitoring sites" },
        { id: "mda8-pred", title: "Pred MDA8", desc: "Predicted MDA8 from the Generalized Additive Model (GAM)" },
        { id: "smo", title: "SMO", desc: "Smoke contribution to O3 (or Smoke O3, SMO), SMO is equal to Residual on smoke days (NA for non-smoke day)" },
        { id: "resids", title: "Residual", desc: "The difference between observed and predicted MDA8 (Obs MDA8 - Pred MDA8) from GAM" },
        { id: "resids-quant", title: "Quant residual", desc: "Estimated residual quantile based on non-smoke days" },
        { id: "pm25-obs", title: "Obs PM2.5", desc: "Daily average PM2.5 concentration observed at AQS monitoring sites" },
        { id: "pm25-quant", title: "Quant PM2.5", desc: "Estimated PM2.5 quantile based on HMS = 0 (non-overhead smoke plume cases) by month" },
        { id: "pm25-crit", title: "PM2.5-crit", desc: "PM2.5-criteria using Med + 1.0 MAD method" },
        { id: "tmax", title: "TMAX", desc: "Daily maximum temperature (K) from MERRA-2" },
        { id: "srad", title: "SRAD", desc: "Daily mean surface shortwave solar flux (W m⁻²) from MERRA-2" },
        { id: "mda8-pred-edm", title: "Pred MDA8 (EDM)", desc: "Predicted MDA8 from the Generalized Additive Model (GAM) (EDM version)" },
        { id: "smo-edm", title: "SMO (EDM)", desc: "Smoke contribution to O3 (or Smoke O3, SMO), SMO is equal to Residual on smoke days (NA for non-smoke day) (EDM version)" },
        { id: "resids-edm", title: "Residual (EDM)", desc: "The difference between observed and predicted MDA8 (Obs MDA8 - Pred MDA8) from GAM (EDM version)" },
        { id: "resids-quant-edm", title: "Quant residual (EDM)", desc: "Estimated residual quantile based on non-smoke days (EDM version)" },
        { id: "smokeday", title: "Smoke day (SMD)", desc: "Identified smoke day using HMS and PM2.5-criteria" },
        { id: "smokeday-975", title: "SMO > 97.5th", desc: "[Smoke day] & [SMO > 97.5th percentile residual]" },
        { id: "smokeday-975-edm", title: "SMO > 97.5th (EDM)", desc: "[Smoke day] & [SMO > 97.5th percentile residual] (EDM version)" },
        { id: "ExcDays", title: "Exc. day", desc: "Exceedance days (> 70 ppb): <br> - with minimal SMO = not caused by smoke <br> - with significant SMO (case with SMO > 97.5th percentile residual) = caused by smoke" },
        { id: "ExcDays-edm", title: "Exc. day (EDM)", desc: "Exceedance days (> 70 ppb) (EDM version): <br> - with minimal SMO = not caused by smoke <br> - with significant SMO (case with SMO > 97.5th percentile residual) = caused by smoke" }
    ],
    "desc-published-gam-v1": [
        {
          id: "citation",
          title: "Citation",
          desc: "Lee, H. and Jaffe, D. A.: " +
                "Wildfire impacts on O3 in the continental United States using PM2.5 and a generalized additive model (2018–2023), " +
                "<em>Environ. Sci. Technol.</em>, 58, 14764–14774, 2024. " +
                "<a href='https://doi.org/10.1021/acs.est.4c05870' target='_blank'>https://doi.org/10.1021/acs.est.4c05870</a>"
        },
        { id: "mda8-obs", title: "Obs MDA8", desc: "Daily maximum 8-hour average O3 concentration (MDA8) observed at AQS monitoring sites" },
        { id: "mda8-pred", title: "Pred MDA8", desc: "Predicted MDA8 from the Generalized Additive Model (GAM)" },
        { id: "smo", title: "SMO", desc: "Smoke contribution to O3 (or Smoke O3, SMO), SMO is equal to Residual on smoke days (NA for non-smoke day)" },
        { id: "resids", title: "Residual", desc: "The difference between observed and predicted MDA8 (Obs MDA8 - Pred MDA8) from GAM" },
        { id: "resids-quant", title: "Quant residual", desc: "Estimated residual quantile based on non-smoke days" },
        { id: "pm25-obs", title: "Obs PM2.5", desc: "Daily average PM2.5 concentration observed at AQS monitoring sites" },
        { id: "pm25-quant", title: "Quant PM2.5", desc: "Estimated PM2.5 quantile based on HMS = 0 (non-overhead smoke plume cases) by month" },
        { id: "pm25-crit", title: "PM2.5-crit", desc: "PM2.5-criteria using Med + 1.0 MAD method" },
        { id: "tmax", title: "TMAX", desc: "Daily maximum temperature (°C) from IEM-ASOS" },
        { id: "srad", title: "SRAD", desc: "Daily mean surface shortwave solar flux (W m⁻²) from MERRA-2" },
        { id: "smokeday", title: "Smoke day (SMD)", desc: "Identified smoke day using HMS and PM2.5-criteria" },
        { id: "smokeday-975", title: "SMO > 97.5th", desc: "[Smoke day] & [SMO > 97.5th percentile residual]" },
        { id: "ExcDays", title: "Exc. day", desc: "Exceedance days (> 70 ppb): <br> - with minimal SMO = not caused by smoke <br> - with significant SMO (case with SMO > 97.5th percentile residual) = caused by smoke" }
    ],
    "desc-published-pm-cbsa": [
        {
          id: "citation",
          title: "Citation",
          desc: "Jaffe, D., Lee, H., Magzamen, S., Goldberg, D., and O'Dell, K.: " +
                "Health and Regulatory Impacts of PM2.5 from Wildland Fires for 2019–2024 in the U.S., " +
                "<em>GeoHealth</em>, Under review, 2025.<br>"
        },
        { id: "pm25-obs", title: "Obs PM2.5", desc: "Daily average PM2.5 concentration observed at AQS monitoring sites" },
        { id: "pm25-quant", title: "Quant PM2.5", desc: "Estimated PM2.5 quantile based on HMS = 0 (non-overhead smoke plume cases) by month" },
        { id: "pm25-crit-m0p5m", title: "PM2.5-crit m0p5m", desc: "PM2.5-criteria using Med + 0.5 MAD method (m0p5m)" },
        { id: "pm25-crit-m1p0m", title: "PM2.5-crit m1p0m", desc: "PM2.5-criteria using Med + 1.0 MAD method (m1p0m)" },
        { id: "pm25-smoke-m0p5m", title: "Smoke PM2.5 m0p5m", desc: "Smoke contribution to PM2.5 (Smoke PM2.5) (PM2.5 - PM2.5-criteria (m0p5m))" },
        { id: "pm25-smoke-m1p0m", title: "Smoke PM2.5 m1p0m", desc: "Smoke contribution to PM2.5 (Smoke PM2.5) (PM2.5 - PM2.5-criteria (m1p0m))" },
        { id: "smokeday-m0p5m", title: "Smoke day (SMD) m0p5m", desc: "Identified smoke day using HMS and PM2.5-criteria (m0p5m)" },
        { id: "smokeday-m1p0m", title: "Smoke day (SMD) m1p0m", desc: "Identified smoke day using HMS and PM2.5-criteria (m1p0m)" },
        { id: "ExcDays-m0p5m", title: "Exc. day m0p5m", desc: "Exceedance days (> 9 ug m⁻³): <br> - with minimal smoke PM2.5 = not caused by smoke <br> - with significant smoke PM2.5 (m0p5m) (case with smoke PM2.5 > 0) = caused by smoke" },
        { id: "ExcDays-m1p0m", title: "Exc. day m1p0m", desc: "Exceedance days (> 9 ug m⁻³): <br> - with minimal smoke PM2.5 = not caused by smoke <br> - with significant smoke PM2.5 (m1p0m) (case with smoke PM2.5 > 0) = caused by smoke" }
    ],
    "desc-published-epa-ember": [
        {
          id: "citation",
          title: "Citation",
          desc: "Simon, H. Beidler, J., Baker, K. R., Henderson, B. H., Fox, L., Misenis, C., Campbell, P., Vukovich, J., Possiel, N., and Eyth, A.: " +
                "Expediated modeling of burn events results (EMBER): A screening-level dataset of 2023 ozone fire impacts in the US, " +
                "<em>Data in Brief</em>, 58, 111208, 2024. " +
                "<a href='https://doi.org/10.1016/j.dib.2024.111208' target='_blank'>https://doi.org/10.1016/j.dib.2024.111208</a>"
        },
        { id: "mda8-obs", title: "Obs MDA8", desc: "Daily maximum 8-hour average O3 concentration (MDA8) observed at AQS monitoring sites" },
        { id: "mda8-pred", title: "Pred MDA8", desc: "Predicted MDA8 from the EMBER model" },
        { id: "smo", title: "SMO", desc: "Smoke contribution to O3 (or Smoke O3, SMO)" },
        { id: "resids", title: "Residual", desc: "The difference between observed and predicted MDA8 (Obs MDA8 - Pred MDA8) from EMBER model" },
        { id: "ExcDays", title: "Exc. day", desc: "Exceedance days (> 70 ppb): <br> - with minimal SMO = not caused by smoke <br> - with significant SMO (case with SMO > 0) = caused by smoke" }
    ]
};

const mainTabBtns = document.querySelectorAll(".Desc-tab-main-btn");
const subTabContainer = document.getElementById("DescSubTabs");
const subTabBtns = document.querySelectorAll(".Desc-tab-sub-btn");
const contentArea = document.getElementById("DescContent");

export function renderParamDesc(dsKey) {
    const items = DescData[dsKey] || [];
    let html = "";

    items.forEach(item => {
        const safeTitle = ESML(item.title);

        if (item.id === "wildfire-news") {
            html += `
                <div class="Desc-item">
                    <h4>${safeTitle} <canvas class="ui-pulsing-icon" data-type="news" width="30" height="30" style="vertical-align:middle; margin-left:0.4rem;"></canvas></h4>
                    <p>${item.desc}</p>
                </div>
            `;
        } else if (item.id === "wildfire-nifc") {
            html += `
                <div class="Desc-item">
                    <h4>${safeTitle} <canvas class="ui-pulsing-icon" data-type="fire" width="30" height="30" style="vertical-align:middle; margin-left:0.4rem;"></canvas></h4>
                    <p>${item.desc}</p>
                </div>
            `;
        } else if (item.id === "MapPost") {
            html += `
                <div class="Desc-item">
                    <h4>${safeTitle} <canvas class="ui-pulsing-icon" data-type="alert" width="30" height="30" style="vertical-align:middle; margin-left:0.4rem;"></canvas></h4>
                    <p>${item.desc}</p>
                </div>
            `;
        } else {
            html += `
                <div class="Desc-item">
                    <h4>${safeTitle}</h4>
                    <p>${item.desc}</p>
                </div>
            `;
        }

    });

    if (html === "") {
        html = "<p>No description available for this dataset.</p>";
    }

    contentArea.innerHTML = html;

    if (initUIPulsingIcons) {
        initUIPulsingIcons();
    }
}

function switchGroup(group) {
    mainTabBtns.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("Desc-group") === group);
    });

    if (group === "LyrGroupPublished") {
        subTabContainer.style.display = "flex";
        const activeSub = subTabContainer.querySelector(".Desc-tab-sub-btn.active") || subTabBtns[0];
        activeSub.classList.add("active");
        renderParamDesc(activeSub.getAttribute("Desc-ds"));
    } else if (group === "LyrGroupAirnow") {
        subTabContainer.style.display = "none";
        renderParamDesc("desc-airnow");
    } else if (group === "LyrGroupNIFC") {
        subTabContainer.style.display = "none";
        renderParamDesc("desc-nifc");
    } else if (group === "LyrGroupSatellite") {
        subTabContainer.style.display = "none";
        renderParamDesc("desc-satellite");
    }
}

mainTabBtns.forEach(btn => {
    btn.addEventListener("click", function () {
        const group = this.getAttribute("Desc-group");
        switchGroup(group);
    });
});

subTabBtns.forEach(btn => {
    btn.addEventListener("click", function () {
        // Update active state
        subTabBtns.forEach(b => b.classList.remove("active"));
        this.classList.add("active");

        // Render content
        const dsKey = this.getAttribute("Desc-ds");
        renderParamDesc(dsKey);
    });
});


/**
 * Programmatically open a specific description category
 */
export function onDescDrawerOpen() {
    const activeMain = document.querySelector(".Desc-tab-main-btn.active") || mainTabBtns[0];
    if (activeMain) switchGroup(activeMain.getAttribute("Desc-group"));
}

/**
 * Creates and appends a help icon click handler that shows a help modal.
 */
export function appendDrawerHelpIcon(drawerId, descId) {
    
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;

    const toggleItem = drawer.querySelector(".toggle-switch-item");
    if (!toggleItem) return;

    let foundItem = null;
    for (const group in DescData) {
        foundItem = DescData[group].find(item => item.id === descId);
        if (foundItem) break;
    }

    const helpBtn = document.createElement("button");
    helpBtn.className = "drawer-help-btn";

    // Dynamic tooltip based on found title
    const itemName = foundItem ? foundItem.title : "this data";
    helpBtn.title = `? ${itemName}`;

    helpBtn.innerHTML = `
        <svg width="20" height="20">
            <use xlink:href="#icon-help" />
        </svg>
    `;

    helpBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showHelpModal(descId);
    });

    toggleItem.appendChild(helpBtn);
}

/**
 * Creates and appends a help icon click handler to any generic container.
 */
export function appendGenericHelpIcon(containerId, descId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let foundItem = null;
    for (const group in DescData) {
        foundItem = DescData[group].find(item => item.id === descId);
        if (foundItem) break;
    }

    const helpBtn = document.createElement("button");
    helpBtn.className = "drawer-help-btn";

    // Dynamic tooltip based on found title
    const itemName = foundItem ? foundItem.title : "this data";
    helpBtn.title = `? ${itemName}`;

    helpBtn.innerHTML = `
        <svg width="20" height="20">
            <use xlink:href="#icon-help" />
        </svg>
    `;

    helpBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showHelpModal(descId);
    });

    container.appendChild(helpBtn);
}

/**
 * Displays a standalone help modal with content from DescData
 */
export function showHelpModal(descId, targetGroup = null) {
    let found = null;
    if (targetGroup && DescData[targetGroup]) {
        found = DescData[targetGroup].find(item => item.id === descId);
    }
    if (!found) {
        for (const group in DescData) {
            found = DescData[group].find(item => item.id === descId);
            if (found) break;
        }
    }
    if (!found) return;

    const overlay = document.createElement("div");
    overlay.className = "drawer-help-overlay";

    overlay.innerHTML = `
        <div class="drawer-help-modal">
            <div class="drawer-help-header">
                <h3>${ESML(found.title)}</h3>
                <button class="ui-btn-close" id="DrawerHelpClose">
                    <svg width="20" height="20">
                        <use xlink:href="#icon-close" />
                    </svg>
                </button>
            </div>
            <div class="drawer-help-body">
                <p>${found.desc}</p>
            </div>
        </div>
    `;

    const close = () => {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector("#DrawerHelpClose").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

    document.body.appendChild(overlay);
}


/**
 * Appends a help icon to all layer checkboxes in the accordion that have a corresponding DescData entry.
 */
export function appendAllLayerHelpIcons() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="layer-"]');
    checkboxes.forEach(chk => {
        const descId = chk.id.replace("layer-", "");

        // 1. Validate if drawing is even needed BEFORE generating DOM nodes.
        let foundItem = null;
        for (const group in DescData) {
            foundItem = DescData[group].find(item => item.id === descId);
            if (foundItem) {
                break;
            }
        }
        if (!foundItem) return;

        const parentLabel = chk.closest("label");
        if (!parentLabel) return;
        
        // Skip modern toggle switches, they are handled separately by appendDrawerHelpIcon
        if (parentLabel.classList.contains("toggle-switch-label")) return;

        // Skip if already attached
        if (parentLabel.querySelector(".layer-help-btn")) return;
          
        // 4. Add Download Button for AirNow layers
        if (descId.startsWith("airnow-")) {
            const dlBtn = createExportButton({
                label: "⬇ .CSV",
                className: "layer-dl-btn",
                style: {
                    position: "absolute",
                    right: "3.5rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "2px 6px",
                    fontSize: "10px",
                    lineHeight: "1",
                    height: "22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap"
                },
                onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDownloadForLayer(descId, { title: foundItem.title });
                }
            });

            parentLabel.style.paddingRight = "6.5rem";
            parentLabel.appendChild(dlBtn);
        }
        
        const helpBtn = document.createElement("span");
        helpBtn.className = "layer-help-btn drawer-help-btn";
        helpBtn.title = `? ${foundItem.title}`;

        // Apply absolute positioning for perfect vertical centering
        parentLabel.style.position = "relative";
        parentLabel.style.paddingRight = "2.5rem"; // prevent text overlap

        helpBtn.style.position = "absolute";
        helpBtn.style.right = "0.5rem";
        helpBtn.style.top = "50%";
        helpBtn.style.transform = "translateY(-50%)";
        helpBtn.style.padding = "0.2rem";
        helpBtn.style.margin = "0";
        helpBtn.style.display = "flex";
        helpBtn.style.alignItems = "center";

        helpBtn.innerHTML = `
            <svg width="20" height="20">
                <use xlink:href="#icon-help" />
            </svg>
        `;

        helpBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Determine active dataset to fetch correct description
            const datasetSelect = document.getElementById("MapDataSelect");
            let targetGroup = null;

            if (datasetSelect && chk.closest("#MapCheckboxPublished")) {
                const val = datasetSelect.value;
                if (val === "gam-v2" || val === "gam-v2-pred") targetGroup = "desc-published-gam-v2";
                else if (val === "gam-v1") targetGroup = "desc-published-gam-v1";
                else if (val === "pm-cbsa" || val === "pm-cbsa-pred") targetGroup = "desc-published-pm-cbsa";
                else if (val === "epa-ember") targetGroup = "desc-published-epa-ember";
            }

            // Reuse the main help modal logic
            showHelpModal(descId, targetGroup);
        });

        // Insert just before the checkbox
        parentLabel.insertBefore(helpBtn, chk);
    });
}

