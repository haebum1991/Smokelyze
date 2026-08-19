
import { ESML } from "./utils.js";
import { initUIPulsingIcons } from "./layers-icon.js";
import { createExportButton } from "./ui-download.js";
import { openLayerTableModal } from "./layers-table.js";

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
            id: "show-day-night",
            title: "Show Day/Night Shadow",
            desc: "If enabled, a semi-transparent shadow representing the Earth's night hemisphere is overlaid on the map. <br><i>* Note</i>: This layer is active and visible only when viewing hourly datasets."
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
                  "<li><b>Default, Light, Topo</b>: These maps use lightweight <b>Raster (PNG)</b> images. They have very low memory usage, consume minimal GPU resources, and ensure high stability on older devices.</li>" +
                  "<li><b>Vector</b>: This map relies on high-resolution <b>Vector Tiles</b>. It provides extremely crisp details and smooth zooming, but requires significantly higher GPU/VRAM resources to render.</li></ul>" +
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
            desc: "<b>Wildfire News</b> are automatically retrieved from Google News based on <b>UTC time</b>. " +
                  "The system monitors key terms such as <em>'wildfire'</em>, <em>'smoke plume'</em>, <em>'forest fire'</em>, etc. to provide the latest updates. " +
                  "Since precise incident coordinates are rarely available in news feeds, articles are assigned to <b>representative state-level locations</b>. " +
                  "To ensure visibility when multiple articles share the same state, a <b>small random jitter</b> is applied to prevent markers from overlapping. " +
                  "All collected articles are consolidated in the <b>side drawer</b> for easy browsing, ensuring that news across all regions can be accessed regardless of map localization." +
                  "<br><ul><li>Update cycle: <b>Every 6 hours</b> (at 0, 6, 12, 18 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2018-01-01. </b>" +
                  "The data is collected every 6 hours and the map is updated accordingly. </li>" +
                  "<li>Depending on the keywords used for collection, irrelevant news articles may be included in the results.</li></ul>"
        },
        {
            id: "MapPost",
            title: "MapPost",
            desc: "<b>MapPost</b> is a community-driven feature that allows users to share insights, opinions, and observations directly on the map. " +
                  "Users can pin a location and add a title and detailed content. " +
                  "Other members can also reply to MapPost to foster discussion. " +
                  "To add a MapPost, toggle the MapPost layer and click [+MapPost] button (or Right-click on the map)." +
                  "<br><ul><li>Update cycle: <b>Real-time</b></li>" +
                  "<li>In our app, <b>" +
                  "this data is managed in real-time. </b>" +
                  "Only registered users can create or reply to MapPost. </li></ul>"
        },
        {
            id: "HysplitSim",
            title: "HYSPLIT Simulation",
            desc: "<b>HYSPLIT (Hybrid Single-Particle Lagrangian Integrated Trajectory)</b> is a model for computing air mass trajectories, as well as complex transport, and dispersion. <br><br>" +
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
            id: "wildfire-inci-curr",
            title: "WF incidents (Live)",
            desc: "<b>Wildfire (WF) live current incidents </b> are fetched directly from " +
                "<b>NIFC (National Interagency Fire Center) WFIGS (Wildland Fire Interagency Geospatial Services)</b>. " +
                "This dataset provides real-time verified point locations of current active wildland fires." +
                "<br><ul><li>Update cycle: <b>Every hour</b></li>" +
                "<li>Data Source: <a href='https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0' target='_blank' rel='noopener noreferrer'>NIFC WFIGS Incident Locations Current (ArcGIS REST)</a></li></ul>"
        },
        {
            id: "wildfire-peri-curr",
            title: "WF perimeters (Live)",
            desc: "<b>Wildfire (WF) live current perimeters </b> are fetched directly from " +
                "<b>NIFC (National Interagency Fire Center) WFIGS (Wildland Fire Interagency Geospatial Services)</b>. " +
                "This dataset provides real-time perimeter boundary polygons of current active wildland fires." +
                "<br><ul><li>Update cycle: <b>Every hour</b></li>" +
                "<li>Data Source: <a href='https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0' target='_blank' rel='noopener noreferrer'>NIFC WFIGS Interagency Perimeters Current (ArcGIS REST)</a></li></ul>"
        },
        {
            id: "wildfire-inci",
            title: "WF incidents",
            desc: "<b>Wildfire (WF) incidents </b> are retrieved from the " +
                "<b>NIFC (National Interagency Fire Center) WFIGS (Wildland Fire Interagency Geospatial Services)</b>. " +
                "This dataset provides verified information on wildland fire occurrences based on " +
                "<b>UTC time</b>, " +
                "including <em>incident name</em>, <em>fire cause</em>, and <em>burn area (acres)</em>. " +
                "This data includes <b>precise discovery coordinates</b> as reported by fire management agencies via the Integrated Reporting of Wildland-Fire Information (IRWIN). " +
                "The system captures a wide range of incident types and categories, ensuring a comprehensive overview of fire events across the region." +
                "<br><ul><li>Update cycle: <b>Every 6 hours</b> (at 0, 6, 12, 18 UTC)</li>" +
                "<li><b>Filtering & Lookback Note</b>: Historical data is queried from BigQuery based on <b>Discovery Time (FireDiscoveryDateTime)</b>. Use the <b>Lookback (days)</b> control (0 to 15 days) in the legend drawer to include fires discovered within N days prior to the selected date.</li>" +
                "<li>In our app, <b>this data is available starting from 2018-01-01. </b></li>" +
                "<li>Data Source: <a href='https://services3.arcgis.com/T4QMspbfLg3qTGWY/ArcGIS/rest/services/WFIGS_Incident_Locations/FeatureServer/0' target='_blank' rel='noopener noreferrer'>NIFC WFIGS Incident Locations (ArcGIS REST)</a></li></ul>"
        },
        {
            id: "wildfire-peri",
            title: "WF perimeters",
            desc: "<b>Wildfire (WF) interagency perimeters </b> are retrieved from the " +
                "<b>NIFC (National Interagency Fire Center) WFIGS (Wildland Fire Interagency Geospatial Services)</b>. " +
                "This dataset provides official polygon perimeter boundaries of active and historical wildland fires based on " +
                "<b>UTC time</b>, " +
                "including <em>polygon incident name</em>, <em>GIS acres</em>, and <em>IRWIN ID</em>. " +
                "This spatial data captures the actual spatial extent and perimeter geometry as mapped by interagency fire management teams via the Integrated Reporting of Wildland-Fire Information (IRWIN)." +
                "<br><ul><li>Update cycle: <b>Every 6 hours</b> (at 0, 6, 12, 18 UTC)</li>" +
                "<li><b>Filtering & Lookback Note</b>: Historical perimeter data is queried from BigQuery based on <b>Discovery Time (attr_FireDiscoveryDateTime)</b>. Use the <b>Lookback (days)</b> control (0 to 15 days) in the legend drawer to include perimeters discovered within N days prior to the selected date.</li>" +
                "<li>In our app, <b>this data is available starting from 2020-01-01. </b></li>" +
                "<li>Data Source: <a href='https://services3.arcgis.com/T4QMspbfLg3qTGWY/ArcGIS/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0' target='_blank' rel='noopener noreferrer'>NIFC WFIGS Interagency Perimeters (ArcGIS REST)</a></li></ul>"
        }
    ],
    "desc-airnow": [
        {
            id: "airnow-daily-mda8",
            title: "Obs MDA8",
            desc: "<b>Obs MDA8</b> provides the maximum daily 8-hour average ozone concentrations from the US EPA AirNow network. " +
                  "MDA8 is the primary metric used for ozone air quality standards and health assessments. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 9 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2018-07-18. </b></li>" +
                  "<li>Typically has a <b>1-day reporting delay</b> from the current date.</li></ul>"
        },
        {
            id: "airnow-daily-pm25",
            title: "Obs PM2.5",
            desc: "<b>Obs PM2.5</b> provides 24-hour averaged fine particulate matter concentrations from the US EPA AirNow network. " +
                  "This daily data is useful for assessing longer-term air quality trends and compliance with daily air quality standards. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 9 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2018-07-18. </b></li>" +
                  "<li>Typically has a <b>1-day reporting delay</b> from the current date.</li></ul>"
        },
        {
            id: "airnow-hourly-ozone",
            title: "Obs O3 (hourly)",
            desc: "<b>Obs O3 (hourly)</b> provides real-time hourly ground-level ozone (O3) concentrations from the US EPA AirNow network. " +
                  "Ground-level ozone is formed by chemical reactions between pollutants and sunlight, often exacerbated by wildfire emissions. " +
                  "<br><ul><li>Update cycle: <b>Every 6 hours</b> (at 3, 9, 15, 21 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2019-07-01. </b></li>" +
                  "<li>Typically has up to a <b>6-hr reporting delay</b> from the current local time.</li></ul>"
        },
        {
            id: "airnow-hourly-pm25",
            title: "Obs PM2.5 (hourly)",
            desc: "<b>Obs PM2.5 (hourly)</b> provides real-time hourly fine particulate matter (PM2.5) concentrations from the US EPA AirNow network. " +
                  "This data is crucial for identifying immediate smoke impacts and tracking air quality trends as they happen. " +
                  "<br><ul><li>Update cycle: <b>Every 6 hours</b> (at 3, 9, 15, 21 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2019-07-01. </b></li>" +
                  "<li>Typically has up to a <b>6-hr reporting delay</b> from the current local time.</li></ul>"
        },
        {
            id: "airnow-hourly-no2",
            title: "Obs NO2 (hourly)",
            desc: "<b>Obs NO2 (hourly)</b> provides real-time hourly nitrogen dioxide (NO2) concentrations from the US EPA AirNow network. " +
                  "NO2 is a primary pollutant from combustion sources and is a key precursor to ozone and secondary particulate matter formation. " +
                  "<br><ul><li>Update cycle: <b>Every 6 hours</b> (at 3, 9, 15, 21 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2019-07-01. </b></li>" +
                  "<li>Typically has up to a <b>6-hr reporting delay</b> from the current local time.</li></ul>"
        }
    ],
    "desc-satellite": [
        {
          id: "smoke",
          title: "HMS-smoke",
          desc: "<b>NOAA-HMS Smoke Plumes</b> are satellite-derived products highlighting areas of overhead smoke. " +
                "Statistical summaries represent the coverage area (km²) within administrative boundaries. " +
                "<br><ul><li>Update cycle: <b>Twice Daily</b> (at 13, 18 UTC)</li>" +
                "<li>In our app, <b>" +
                "this data is available starting from 2018-01-01. </b>" +
                "Due to the NOAA HMS processing cycle, " +
                "Finalized data are typically published at 11:00-13:00 UTC on the following day, " +
                "and current preliminary data are published at 16:00-18:00 UTC on the current day. </li></ul>"
        },
        {
          id: "fire",
          title: "HMS-fire",
          desc: "<b>NOAA-HMS Fire Points</b> represent thermal anomalies and Fire Radiative Power (FRP). " +
                "The points are <b>spatially aggregated at 0.001 degree (~ 0.1 km) resolution</b> to ensure clarity and prevent overlapping markers. " +
                "And then, the <b>regional statistics</b> (fire points and FRP) are computed. " +
                "<br><ul><li>Update cycle: <b>Twice Daily</b> (at 13, 18 UTC)</li>" +
                "<li>In our app, <b>" +
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
                "<br><ul><li>Update cycle: <b>Manual/On-demand</b></li>" +
                "<li>In our app, <b>" +
                "this data is available starting from 2018-01-01, </b>" + 
                "and is updated on an as-available basis. </li></ul>"
        },
        {
            id: "tempo-no2",
            title: "TEMPO-NO2VCD (hourly)",
            desc: "<b>TEMPO-NO2VCD (hourly) (L3)</b> provides high-resolution tropospheric vertical column density (VCD) of nitrogen dioxide (NO<sub>2</sub>) from NASA's geostationary TEMPO satellite. " +
                  "Data is strictly filtered using the official <em>Main Quality Flag (0)</em> and a <em>Cloud Fraction threshold (< 10%)</em> to ensure high-accuracy, clear-sky observations. " +
                  "It allows for near real-time tracking of nitrogen dioxide levels over North America in unit of 10<sup>14</sup> molecules cm<sup>-2</sup>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2023-08-02, </b>" + 
                  "and, <b>spatially aggregated to 0.04&deg; (~ 4.4 km)</b> for visualization performance.</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1. </li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li></ul>"
        },
        {
            id: "tempo-hcho",
            title: "TEMPO-HCHOVCD (hourly)",
            desc: "<b>TEMPO-HCHOVCD (hourly) (L3)</b> provides high-resolution vertical column density (VCD) of formaldehyde (HCHO) from NASA's geostationary TEMPO satellite. " +
                  "Data is strictly filtered using the official <em>Main Quality Flag (0)</em> and a <em>Cloud Fraction threshold (< 10%)</em> to ensure high-accuracy, clear-sky observations. " +
                  "It allows for near real-time tracking of formaldehyde levels over North America in unit of 10<sup>14</sup> molecules cm<sup>-2</sup>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2023-08-02, </b>" + 
                  "and, <b>spatially aggregated to 0.04&deg; (~ 4.4 km)</b> for visualization performance.</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1. </li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li></ul>"
        },
        {
            id: "tropomi-no2",
            title: "TROPOMI-NO2VCD",
            desc: "<b>TROPOMI-NO2VCD (L3)</b> maps are based on Collection 3 of the Sentinel-5P Nitrogen Dioxide Level-2 products (L2__NO2___) from the Copernicus Data Space Ecosystem. " +
                  "Data is strictly filtered according to the official recommendation (<b>QA value > 0.75</b>) to ensure high-accuracy, clear-sky observations. " +
                  "The measurements are mapped on a fixed grid and processed into Level-3 data by <b>S5P-PAL</b>, providing tropospheric vertical column density (VCD) in units of 10<sup>14</sup> molecules cm<sup>-2</sup>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 16 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2018-05-01. </b>" +
                  "and, <b>spatially aggregated to 0.044&deg; (~ 5 km)</b> for visualization performance.</li>" +
                  "<li>Due to the S5P-PAL data processing cycle, the most recent dataset is available with <b>approximately 2-week latency</b>.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://maps.s5p-pal.com/no2-tropospheric/' target='_blank' rel='noopener noreferrer'>S5P-PAL NO2 Map</a></li></ul>"
        },
        {
            id: "tropomi-hcho",
            title: "TROPOMI-HCHOVCD",
            desc: "<b>TROPOMI-HCHOVCD (L3)</b> maps are based on Collection 3 of the Sentinel-5P Formaldehyde Level-2 products (L2__HCHO__) from the Copernicus Dataspace Browser. " +
                  "Data is strictly filtered according to the official recommendation (<b>QA Value > 0.5</b>) to ensure high-accuracy, clear-sky observations. " +
                  "The measurements are mapped on a fixed grid and processed into Level-3 data by <b>S5P-PAL</b>, tracking formaldehyde levels over North America in units of 10<sup>14</sup> molecules cm<sup>-2</sup>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 16 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2018-05-07. </b>" +
                  "and, <b>spatially aggregated to 0.044&deg; (~ 5 km)</b> for visualization performance.</li>" +
                  "<li>Due to the S5P-PAL data processing cycle, the most recent dataset is available with <b>approximately 2-week latency</b>.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://maps.s5p-pal.com/no2-tropospheric/' target='_blank' rel='noopener noreferrer'>S5P-PAL NO2 Map</a></li></ul>"
        },
        {
            id: "goes-aod-east",
            title: "GOES-AOD-East (hourly)",
            desc: "<b>GOES-AOD-East (hourly) (L2)</b> provides hourly Aerosol Optical Depth (AOD) measurements from the GOES-East geostationary satellite (GOES-16 for dates before 2025-01-01; GOES-19 for dates after 2025-01-01) over North America. AOD is a dimensionless measure of light extinction by aerosols (e.g., smoke, dust, haze) in the atmospheric column. " +
                  "This dataset is processed through a cloud-based automated pipeline that extracts raw sub-hourly netCDF files from NOAA's public Google Cloud Storage bucket. " +
                  "Due to quality control filtering, only high-quality pixels (<b>Data Quality Flag DQF = 0</b>) within the <b>valid range (-0.05 to 5.0)</b> are retained. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2018-01-01, </b>" + 
                  "and <b>spatially aggregated to 4 km</b> for visualization performance. (Original ABI AOD resolution is 2 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li></ul>"
        },
        {
            id: "goes-aod-west",
            title: "GOES-AOD-West (hourly)",
            desc: "<b>GOES-AOD-West (hourly) (L2)</b> provides hourly Aerosol Optical Depth (AOD) measurements from the GOES-West geostationary satellite (GOES-17 for dates before 2023-01-01; GOES-18 for dates after 2023-01-01) over Western North America. AOD is a dimensionless measure of light extinction by aerosols (e.g., smoke, dust, haze) in the atmospheric column. " +
                  "This dataset is processed through a cloud-based automated pipeline that extracts raw sub-hourly netCDF files from NOAA's public Google Cloud Storage bucket. " +
                  "Due to quality control filtering, only high-quality pixels (<b>Data Quality Flag DQF = 0</b>) within the <b>valid range (-0.05 to 5.0)</b> are retained. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2019-01-01, </b>" + 
                  "and <b>spatially aggregated to 4 km</b> for visualization performance. (Original ABI AOD resolution is 2 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li></ul>"
        },
        {
            id: "goes-geocolor-east",
            title: "GOES-GeoColor-East (hourly)",
            desc: "<b>GOES-GeoColor-East (hourly)</b> provides hourly true-color composite imagery from the GOES-East geostationary satellite (GOES-16/GOES-19) over the CONUS domain. " +
                "GeoColor is a multi-band composite that blends visible and infrared channels to produce a near-true-color image during daytime and a city lights / infrared cloud composite at nighttime. " +
                "<br><i>* Source Note</i>: For dates before <b>2026-04-08</b>, the imagery is fetched via the <b>NOAA NESDIS OGC Tiles API</b> (<code>fire.data.nesdis.noaa.gov</code>). For dates on or after <b>2026-04-08</b>, it is fetched via the <b>NASA Worldview API</b> (<code>gibs.earthdata.nasa.gov</code>). " +
                "Each frame is downloaded as a single composite PNG/WebP, reprojected to Web Mercator (EPSG:3857), and auto-cropped to remove transparent borders. " +
                "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                "<li>In our app, <b>" +
                "this data is available starting from 2025-06-26, </b>" +
                "and <b>spatially aggregated to 4 km</b> for visualization performance.</li>" +
                "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li></ul>"
        },
        {
            id: "goes-geocolor-west",
            title: "GOES-GeoColor-West (hourly)",
            desc: "<b>GOES-GeoColor-West (hourly)</b> provides hourly true-color composite imagery from the GOES-West geostationary satellite (GOES-18) over the CONUS domain. " +
                "GeoColor is a multi-band composite that blends visible and infrared channels to produce a near-true-color image during daytime and a city lights / infrared cloud composite at nighttime. " +
                "<br><i>* Source Note</i>: For dates before <b>2026-04-08</b>, the imagery is fetched via the <b>NOAA NESDIS OGC Tiles API</b> (<code>fire.data.nesdis.noaa.gov</code>). For dates on or after <b>2026-04-08</b>, it is fetched via the <b>NASA Worldview API</b> (<code>gibs.earthdata.nasa.gov</code>). " +
                "Each frame is downloaded as a single composite PNG/WebP, reprojected to Web Mercator (EPSG:3857), and auto-cropped to remove transparent borders. " +
                "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                "<li>In our app, <b>" +
                "this data is available starting from 2025-06-26, </b>" +
                "and <b>spatially aggregated to 4 km</b> for visualization performance.</li>" +
                "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li></ul>"
        },
        {
            id: "viirs-truecolor",
            title: "VIIRS-TrueColor",
            desc: "<b>VIIRS-TrueColor</b> provides daily corrected reflectance true-color imagery from the NOAA-21 (JPSS-2) satellite's VIIRS instrument. " +
                "Unlike geostationary GOES imagery, VIIRS is a polar-orbiting sensor that captures high-resolution swath data once per day over each location, offering superior spatial detail at the cost of temporal frequency. " +
                "This dataset is fetched via the <b>NASA Worldview WMS API</b> (<code>gibs.earthdata.nasa.gov</code>) using the <code>VIIRS_NOAA21_CorrectedReflectance_TrueColor</code> layer. " +
                "Each daily composite is downloaded as a single PNG, and areas outside the satellite swath are transparent. " +
                "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                "<li>In our app, <b>" +
                "this data is available starting from 2023-02-10, </b>" +
                "and <b>spatially aggregated to 4 km</b> for visualization performance.</li>" +
                "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li></ul>"
        }
    ],
    "desc-model": [
        {
            id: "hrrr-colmd",
            title: "HRRR-smokeVCD (hourly)",
            desc: "<b>HRRR-smokeVCD (Smoke Vertically Integrated)</b> provides column-integrated smoke mass density from the NOAA High-Resolution Rapid Refresh (HRRR) model. " +
                  "This dataset represents the total mass of smoke in the atmospheric column from the surface to the top of the atmosphere, measured in units of <b>&micro;g m<sup>-2</sup></b>. " +
                  "It is particularly useful for understanding the total overhead smoke load and long-range transport of smoke plumes. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2021-01-01, </b>" + 
                  "and <b>spatially aggregated to 6-7 km</b> for visualization performance. (Original HRRR resolution is 3 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1. </li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://console.cloud.google.com/storage/browser/high-resolution-rapid-refresh' target='_blank' rel='noopener noreferrer'>NOAA High-Resolution Rapid Refresh (Google Cloud Storage)</a></li></ul>"
        },
        {
            id: "hrrr-massden",
            title: "HRRR-smoke8m (hourly)",
            desc: "<b>HRRR-smoke8m (Smoke 8-m above ground)</b> provides near-surface (8 m) smoke mass concentration from the NOAA High-Resolution Rapid Refresh (HRRR) model. " +
                  "This dataset estimates the concentration of smoke particles at 8 meters above ground level, measured in units of <b>&micro;g m<sup>-3</sup></b>. " +
                  "It is highly relevant for assessing ground-level air quality impacts and potential health risks associated with wildfire smoke. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>" +
                  "this data is available starting from 2021-01-01, </b>" + 
                  "and <b>spatially aggregated to 6-7 km</b> for visualization performance. (Original HRRR resolution is 3 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1. </li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://console.cloud.google.com/storage/browser/high-resolution-rapid-refresh' target='_blank' rel='noopener noreferrer'>NOAA High-Resolution Rapid Refresh (Google Cloud Storage)</a></li></ul>"
        },
        {
            id: "geoscf-o3",
            title: "GEOS-CF-O3 (hourly)",
            desc: "<b>NASA GEOS-CF Surface Ozone (O3)</b> provides hourly surface ozone concentrations from the NASA GMAO GEOS-CF (Composition Forecasting) model system coupled with the full GEOS-Chem tropospheric chemistry mechanism. " +
                  "Ozone is reported in units of <b>ppb</b>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>this data is available starting from 2021-01-01.</b> (Original GEOS-CF resolution is 0.25&deg;, ~28 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://opendap.nccs.nasa.gov/dods/gmao/geos-cf/v2/ana/chm_tavg_1hr_glo_L1440x721_slv.info' target='_blank' rel='noopener noreferrer'>NASA NCCS OpenDAP (GEOS-CF v2)</a></li></ul>"
        },
        {
            id: "geoscf-co",
            title: "GEOS-CF-CO (hourly)",
            desc: "<b>NASA GEOS-CF Surface Carbon Monoxide (CO)</b> provides hourly surface carbon monoxide concentrations from the NASA GMAO GEOS-CF model. " +
                  "CO is a primary combustion tracer emitted directly by wildfires and anthropogenic sources, reported in units of <b>ppb</b>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>this data is available starting from 2021-01-01.</b> (Original GEOS-CF resolution is 0.25&deg;, ~28 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://opendap.nccs.nasa.gov/dods/gmao/geos-cf/v2/ana/chm_tavg_1hr_glo_L1440x721_slv.info' target='_blank' rel='noopener noreferrer'>NASA NCCS OpenDAP (GEOS-CF v2)</a></li></ul>"
        },
        {
            id: "geoscf-no2",
            title: "GEOS-CF-NO2 (hourly)",
            desc: "<b>NASA GEOS-CF Surface Nitrogen Dioxide (NO2)</b> provides hourly ground-level nitrogen dioxide concentrations from the NASA GMAO GEOS-CF model with GEOS-Chem chemistry. " +
                  "NO2 is reported in units of <b>ppb</b>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>this data is available starting from 2021-01-01.</b> (Original GEOS-CF resolution is 0.25&deg;, ~28 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://opendap.nccs.nasa.gov/dods/gmao/geos-cf/v2/ana/chm_tavg_1hr_glo_L1440x721_slv.info' target='_blank' rel='noopener noreferrer'>NASA NCCS OpenDAP (GEOS-CF v2)</a></li></ul>"
        },
        {
            id: "geoscf-hcho",
            title: "GEOS-CF-HCHO (hourly)",
            desc: "<b>NASA GEOS-CF Surface Formaldehyde (HCHO)</b> provides hourly surface formaldehyde concentrations from the NASA GMAO GEOS-CF model. " +
                  "HCHO is a critical intermediate in the oxidation of volatile organic compounds (VOCs) emitted by vegetation and wildfires, reported in units of <b>ppb</b>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>this data is available starting from 2021-01-01.</b> (Original GEOS-CF resolution is 0.25&deg;, ~28 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://opendap.nccs.nasa.gov/dods/gmao/geos-cf/v2/ana/chm_tavg_1hr_glo_L1440x721_slv.info' target='_blank' rel='noopener noreferrer'>NASA NCCS OpenDAP (GEOS-CF v2)</a></li></ul>"
        },
        {
            id: "geoscf-pm25",
            title: "GEOS-CF-PM2.5 (hourly)",
            desc: "<b>NASA GEOS-CF Surface PM2.5</b> provides hourly fine particulate matter mass concentrations at 35% relative humidity (pm25_rh35) simulated by the NASA GMAO GEOS-CF model. " +
                  "PM2.5 is reported in units of <b>&micro;g m<sup>-3</sup></b>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>this data is available starting from 2021-01-01.</b> (Original GEOS-CF resolution is 0.25&deg;, ~28 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://opendap.nccs.nasa.gov/dods/gmao/geos-cf/v2/ana/chm_tavg_1hr_glo_L1440x721_slv.info' target='_blank' rel='noopener noreferrer'>NASA NCCS OpenDAP (GEOS-CF v2)</a></li></ul>"
        },
        {
            id: "geoscf-pm25oc",
            title: "GEOS-CF-PM2.5OC (hourly)",
            desc: "<b>NASA GEOS-CF Organic Carbon PM2.5 (PM2.5OC)</b> provides hourly organic carbon aerosol mass concentrations at 35% relative humidity (pm25oc_rh35) from the NASA GMAO GEOS-CF model. " +
                  "Organic carbon is the primary constituent of wildfire smoke particles, reported in units of <b>&micro;g m<sup>-3</sup></b>. " +
                  "<br><ul><li>Update cycle: <b>Daily</b> (at 12 UTC)</li>" +
                  "<li>In our app, <b>this data is available starting from 2021-01-01.</b> (Original GEOS-CF resolution is 0.25&deg;, ~28 km)</li>" +
                  "<li>Due to our 24-hour retrospective data acquisition protocol, the dataset maintains a one-day latency, making the most current observations representative of D-1.</li>" +
                  "<li><b>Web Raster Note</b>: Served as <b>8-bit PNG rasters with JSON metadata</b> for fast web loading and visual inspection. Minor numeric discrepancies may exist compared to raw 32-bit float files due to web raster encoding.</li>" +
                  "<li>Data Source: <a href='https://opendap.nccs.nasa.gov/dods/gmao/geos-cf/v2/ana/chm_tavg_1hr_glo_L1440x721_slv.info' target='_blank' rel='noopener noreferrer'>NASA NCCS OpenDAP (GEOS-CF v2)</a></li></ul>"
        }
    ],
    "desc-published-intro": [
        {
            id: "general-info",
            title: "General information",
            desc: "The detailed information is provided in the tooltip, and please see the [Parameter descriptions] for each dataset. " +
                  "We recommend using the most recent (highest) version for each analysis." +
                  "<ul><li><b>[UW GAM-v2]</b> includes smoke days and smoke O3 for the wildfire season (<b>Apr-Oct, 2019-2024</b>).</li>" +
                  "<li><b>[UW GAM-v1]</b> includes smoke days and smoke O3 for the wildfire season (<b>May-Sep, 2018-2023</b>).</li>" +
                  "<li><b>[UW Smoke PM2.5]</b> includes smoke days and smoke PM2.5 for the full year (<b>2019-2024</b>).</li>" +
                  "<li><b>[EPA EMBER]</b> includes CMAQ based smoke O3 for the wildfire season (<b>Apr-Sep, 2021-2025</b>).</li>" +
                  "<br>" +
                  "<li><b>[UW GAM-v2 (2025+)]</b> includes smoke days and smoke O3 for the wildfire season (<b>Apr-Oct, 2025+</b>).</li>" +
                  "<li><b>[UW Smoke PM2.5 (2025+)]</b> includes smoke days and smoke PM2.5 for the full year (<b>2025+</b>).</li></ul>"
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
                  "<br><ul><li><b>[UW GAM-v2 (2025+)]</b> includes smoke days and smoke O3 for the wildfire season (Apr-Oct). " +
                  "Due to the update cycle of predictors used in GAM estimation, the most recent data is approximately <b>8-9 weeks old</b>. " +
                  "Based on the EPA data finalization cycle, a full re-analysis of the previous year (e.g., 2025) is typically conducted during Q3-Q4 of the current year (e.g., 2026), and data may be updated accordingly.</li>" +
                  "<li><b>[UW Smoke PM2.5 (2025+)]</b> includes smoke days and smoke PM2.5 for the full year. " +
                  "The most recent data is uploaded with a delay of approximately <b>2-3 days</b>. " +
                  "Based on the EPA data finalization cycle, a full re-analysis of the previous year (e.g., 2025) is typically conducted during Q3-Q4 of the current year (e.g., 2026), and data may be updated accordingly.</li></ul>"
        },
        {
            id: "research-o3-gam",
            title: "Research for smoke contribution to O3 using GAM in the US",
            desc: "<ul><li><b>[UW GAM-v2]</b>, data period: Apr-Oct, 2019-2024, study area: CONUS + AK + HI<ul>" +
                  "<li>EPA data for O3 and PM2.5 (pre-generated data) were downloaded as of 2024-11-19.</li>" +
                  "<li>Lee, H. and Jaffe, D. A.: " +
                  "Impact of Wildfires on O3 and Air Quality Across the United States for 2019–2024 Using Generalized Additive Models, " +
                  "<em>J. Geophys. Res. Atmos.</em>, 130, e2025JD044088, 2025. " +
                  "<a href='https://doi.org/10.1029/2025JD044088' target='_blank'>https://doi.org/10.1029/2025JD044088</a></li></ul></li>" +
                  
                  "<li><b>[UW GAM-v1]</b>, data period: May-Sep, 2018-2023, study area: CONUS<ul>" +
                  "<li>EPA data for O3 and PM2.5 (pre-generated data) were downloaded as of 2023-10-26.</li>" +
                  "<li>Lee, H. and Jaffe, D. A.: " + 
                  "Wildfire impacts on O3 in the continental United States using PM2.5 and a generalized additive model (2018–2023), " +
                  "<em>Environ. Sci. Technol.</em>, 58, 14764–14774, 2024. " +
                  "<a href='https://doi.org/10.1021/acs.est.4c05870' target='_blank'>https://doi.org/10.1021/acs.est.4c05870</a></li></ul></li></ul>"
        },
        {
            id: "research-pm25-gam",
            title: "Research for smoke contribution to PM2.5 in the US",
            desc: "<ul><li><b>[UW Smoke PM2.5]</b>, data period: Jan-Dec, 2019-2024, study area: CONUS + AK + HI<ul>" +
                  "<li>EPA data for O3 and PM2.5 (pre-generated data) were downloaded as of 2024-11-19.</li>" +
                  "<li>Jaffe, D., Lee, H., Magzamen, S., Goldberg, D., and O'Dell, K.: " + 
                  "Health and Regulatory Impacts of PM2.5 from Wildland Fires for 2019–2024 in the US, " +
                  "<em>GeoHealth</em>, 10, e2025GH001576, 2026. " + 
                  "<a href='https://doi.org/10.1029/2025GH001576' target='_blank'>https://doi.org/10.1029/2025GH001576</a></li></ul></li></ul>"
        },
        {
            id: "research-o3-ember",
            title: "Research for smoke contribution to O3 using EMBER in the US",
            desc: "<ul><li><b>[EPA EMBER]</b>, data period: Apr-Sep, 2021-2025, study area: CONUS<ul>" +
                  "<li>Simon, H. Beidler, J., Baker, K. R., Henderson, B. H., Fox, L., Misenis, C., Campbell, P., Vukovich, J., Possiel, N., and Eyth, A.: " +
                  "Expedited modeling of burn events results (EMBER): A screening-level dataset of 2023 ozone fire impacts in the US, " + 
                  "<em>Data in Brief</em>, 58, 111208, 2024. " +
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
        { id: "ExcDays", title: "ExcDay", desc: "Exceedance days (> 70 ppb): <br> - with minimal SMO: not caused by smoke <br> - with significant SMO: caused by smoke (case with SMO > 97.5th percentile residual)" },
        { id: "ExcDays-edm", title: "ExcDay (EDM)", desc: "Exceedance days (> 70 ppb) (EDM version): <br> - with minimal SMO: not caused by smoke <br> - with significant SMO: caused by smoke (case with SMO > 97.5th percentile residual)" }
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
        { id: "ExcDays", title: "ExcDay", desc: "Exceedance days (> 70 ppb): <br> - with minimal SMO: not caused by smoke <br> - with significant SMO: caused by smoke (case with SMO > 97.5th percentile residual)" }
    ],
    "desc-published-pm-cbsa": [
        {
          id: "citation",
          title: "Citation",
          desc: "Jaffe, D., Lee, H., Magzamen, S., Goldberg, D., and O'Dell, K.: " +
                "Health and Regulatory Impacts of PM2.5 from Wildland Fires for 2019–2024 in the US, " +
                "<em>GeoHealth</em>, 10, e2025GH001576, 2026.<br> " +
                "<a href='https://doi.org/10.1029/2025GH001576' target='_blank'>https://doi.org/10.1029/2025GH001576</a>"
        },
        { id: "pm25-obs", title: "Obs PM2.5", desc: "Daily average PM2.5 concentration observed at AQS monitoring sites" },
        { id: "pm25-quant", title: "Quant PM2.5", desc: "Estimated PM2.5 quantile based on HMS = 0 (non-overhead smoke plume cases) by month" },
        { id: "pm25-crit-m0p5m", title: "PM2.5-crit m0p5m", desc: "PM2.5-criteria using Med + 0.5 MAD method (Criteria 1: m0p5m)" },
        { id: "pm25-crit-m1p0m", title: "PM2.5-crit m1p0m", desc: "PM2.5-criteria using Med + 1.0 MAD method (Criteria 2: m1p0m)" },
        { id: "pm25-smoke-m0p5m", title: "Smoke PM2.5 m0p5m", desc: "Smoke contribution to PM2.5 (Smoke PM2.5 = PM2.5 - PM2.5-criteria (Criteria 1: m0p5m))" },
        { id: "pm25-smoke-m1p0m", title: "Smoke PM2.5 m1p0m", desc: "Smoke contribution to PM2.5 (Smoke PM2.5 = PM2.5 - PM2.5-criteria (Criteria 2: m1p0m))" },
        { id: "smokeday-m0p5m", title: "Smoke day (SMD) m0p5m", desc: "Identified smoke day using HMS and PM2.5-criteria (Criteria 1: m0p5m)" },
        { id: "smokeday-m1p0m", title: "Smoke day (SMD) m1p0m", desc: "Identified smoke day using HMS and PM2.5-criteria (Criteria 2: m1p0m)" },
        { id: "ExcDays-m0p5m", title: "ExcDay m0p5m", desc: "Exceedance days (> 35 ug m⁻³) based on Criteria 1 (m0p5m): <br> - with smoke PM2.5=0: not caused by smoke <br> - with smoke PM2.5>0: caused by smoke" },
        { id: "ExcDays-m1p0m", title: "ExcDay m1p0m", desc: "Exceedance days (> 35 ug m⁻³) based on Criteria 2 (m1p0m): <br> - with smoke PM2.5=0: not caused by smoke <br> - with smoke PM2.5>0: caused by smoke" }
    ],
    "desc-published-epa-ember": [
        {
          id: "citation",
          title: "Citation",
          desc: "Simon, H. Beidler, J., Baker, K. R., Henderson, B. H., Fox, L., Misenis, C., Campbell, P., Vukovich, J., Possiel, N., and Eyth, A.: " +
                "Expediated modeling of burn events results (EMBER): A screening-level dataset of 2023 ozone fire impacts in the US, " +
                "<em>Data in Brief</em>, 58, 111208, 2024. " +
                "<a href='https://doi.org/10.1016/j.dib.2024.111208' target='_blank'>https://doi.org/10.1016/j.dib.2024.111208</a><br><br>" +
                "<b>Note</b>: Since variable names in this dataset have been renamed to fit our application (Smokelyze), for the original dataset, " +
                "please see the detailed information: <a href='https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember' target='_blank'>https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember</a>"
        },
        {
          id: "mda8-obs",
          title: "Obs MDA8",
          desc: "Monitored MDA8 Ozone (ppb):<br>" +
                "Monitored MDA8 ozone. This data is based on ozone values available in AQS as of May 23, 2024 (data truncated to nearest whole number).<br><br>" +
                "Please see the detailed information: <a href='https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember' target='_blank'>https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember</a>"
        },
        {
          id: "mda8-pred",
          title: "Pred MDA8",
          desc: "Modeled MDA8 Ozone (ppb): Base Simulation<br>" +
                "Modeled MDA8 ozone from base EMBER simulation for the 36km grid cell in which the monitor is located (data truncated to nearest whole number).<br><br>" +
                "Please see the detailed information: <a href='https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember' target='_blank'>https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember</a>"
        },
        {
          id: "smo",
          title: "SMO",
          desc: "Modeled MDA8 Ozone Impacts from All Fires (ppb):<br>" +
                "EMBER predictions of MDA8 ozone attributed to US and Canadian wild and prescribed fire emissions in the 36km grid cell in which the monitor is located (data rounded to nearest whole number).<br>" +
                "Calculated as: [Modeled MDA8 Ozone (ppb): Base EMBER Simulation] - [Modeled MDA8 Ozone (ppb): Zero Fires Simulation].<br><br>" +
                "Please see the detailed information: <a href='https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember' target='_blank'>https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember</a>"
        },
        {
          id: "resids",
          title: "Residual",
          desc: "[Obs MDA8] - [Pred MDA8]<br>" +
                "Calculated as: [Monitored MDA8 Ozone (ppb)] - [Modeled MDA8 Ozone (ppb): Base Simulation].<br><br>" +
                "Please see the detailed information: <a href='https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember' target='_blank'>https://www.epa.gov/air-quality-analysis/expedited-modeling-burn-events-results-ember</a>"
        },
        { id: "smokeday", title: "Day with SMO > 0", desc: "Identified days with SMO > 0 ppb (1: Yes, 0: No)" },
        { id: "ExcDays", title: "ExcDay", desc: "Exceedance days (> 70 ppb): <br> - with minimal SMO: not caused by smoke <br> - with significant SMO (case with SMO > 0): caused by smoke" }
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

        html += `
            <div class="Desc-item">
                <h4>${safeTitle}</h4>
                <p>${item.desc}</p>
            </div>
        `;
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
    } else if (group === "LyrGroupModel") {
        subTabContainer.style.display = "none";
        renderParamDesc("desc-model");
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
          
        // 4. Add Download Button for specific layers (AirNow, NIFC, HMS-fire)
        const isAirNow = descId.startsWith("airnow-");
        const isNIFC = ["wildfire-inci", "wildfire-peri"].some(p => descId.startsWith(p));
        const isFire = descId === "fire";

        if (isAirNow || isNIFC || isFire) {
            const dlBtn = createExportButton({
                label: "Table",
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
                    openLayerTableModal(descId, { title: foundItem.title });
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
    
    // Dataset Select help button binding
    const datasetHelpBtn = document.getElementById("DatasetHelpBtn");
    if (datasetHelpBtn && !datasetHelpBtn.dataset.bound) {
        datasetHelpBtn.dataset.bound = "true";
        datasetHelpBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            showHelpModal("general-info");
        });
    }
}

