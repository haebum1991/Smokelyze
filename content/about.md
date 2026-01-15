
---
title: ""
---

<script>document.body.classList.add("page-about");</script>

<br>
<h1 style="font-weight: bold; text-align: center; color: white; text-shadow: 0 0.2rem 0.5rem var(--color-black);" >
  PhD. Haebum Lee
</h1>

<div class="reveal-on-scroll" style="text-align: center;">
  <h3 style="font-weight: bold; color: white; text-shadow: 0 0.2rem 0.5rem var(--color-black);">
    Postdoctoral Scholar
  </h3>
  
  <p style="color: white; text-shadow: 0 0.2rem 0.5rem var(--color-black);">
    Jaffe Group, <br>
    School of STEM, <br>
    University of Washington (UW), <br> 
    Bothell, WA, United States<br>
  </p>
  
  <div class="social-links">
    <a href="https://www.linkedin.com/in/haebum-lee-683731305/" target="_blank" rel="noopener noreferrer">
      <img src="/images/linkedin_logo.png" width="30" height="30" alt="LinkedIn">
    </a>
    &nbsp;&nbsp;
    <a href="https://github.com/haebum1991/" target="_blank" rel="noopener noreferrer">
      <img src="/images/github_logo.png" width="30" height="30" alt="GitHub">
    </a>
    &nbsp;&nbsp;
    <a href="https://orcid.org/0009-0001-2045-8532" target="_blank" rel="noopener noreferrer">
      <img src="/images/ORCID_logo.png" width="30" height="30" alt="ORCID">
    </a>
    &nbsp;&nbsp;
    <a href="https://scholar.google.com/citations?user=98LKhgUAAAAJ&hl" target="_blank" rel="noopener noreferrer">
      <img src="/images/ggscholar_logo.png" width="30" height="30" alt="GGS">
    </a>
  </div>
  <br>
</div>


<div class="card-about reveal-on-scroll">
Hello, and Welcome to my Web Application!
I am a scientist who focus on the multifaceted study of air quality and atmospheric phenomena, 
including the analysis of wildfire smoke on ozone, air pollutant monitoring, and 
the utilization of satellite and remote sensing data to assess atmospheric parameters. 
I am also deeply engaged in studying 
the wildfire smoke impacts on air quality, 
the physicochemical properties of atmospheric aerosols,  
the dynamics of new particle formation, and 
the development of predictive models using machine learning.

I hope everything is useful, thank you.
</div>
<br>


<div class="card-about reveal-on-scroll">
<h2 style="font-weight: bold;">Research Interests</h2>

- Wildfire smoke impacts on air quality
- Air pollutant & air quality monitoring
- Analysis of atmospheric parameters using satellite and remote sensing data
- Physicochemical properties of atmospheric aerosols
- Observation of atmospheric new particle formation (NPF) and growth mechanisms
- Observation of nanoparticles at the remote (Arctic), urban, and agricultural sites
- Development of NPF-related and particle morphology prediction model using machine-learning techniques
- Characterization of nanoparticles and sub-micrometer particles in the ambient atmosphere
- Analysis of morphology and elemental composition of ultrafine particles in the ambient atmosphere
</div>
<br>


<div class="card-about reveal-on-scroll">
<h2 style="font-weight: bold;">Education & Experiences</h2>

- **Postdoc / 2023.04-present**  
  <span style="font-size: 1.6rem;"> 
  Jaffe Group, School of Science, Technology, Engineering & Mathematics (STEM), <br>
  University of Washington (UW), Bothell, WA, United States
  </span>
- **Postdoc / 2022.08-2023.03**  
  <span style="font-size: 1.6rem;"> 
  Center for PM2.5 monitoring research, School of Earth Science & Environmental Engineering, <br>
  Gwangju Institute of Science & Technology (GIST), Gwangju, Republic of Korea 
  </span>  
- **PhD / 2018-2022**  
  <span style="font-size: 1.6rem;"> 
  Aerosol Technology Monitoring Lab (ATML), School of Earth Science & Environmental Engineering, <br>
  Gwangju Institute of Science & Technology (GIST), Gwangju, Republic of Korea
  </span>  
- **MS / 2016-2018**  
  <span style="font-size: 1.6rem;"> 
  Aerosol Technology Monitoring Lab (ATML),School of Earth Science & Environmental Engineering, <br>
  Gwangju Institute of Science & Technology (GIST), Gwangju, Republic of Korea
  </span>
- **BS / 2010-2016**  
  <span style="font-size: 1.6rem;"> 
  Chemistry,
  Kyung Hee University, Seoul, Republic of Korea
  </span>
</div>
<br>


<div class="card-about reveal-on-scroll">
<h2 style="font-weight: bold;">Technical skills</h2>

- **Aerosol measurement techniques & Instrumentation**  
  - Condensation particle counter (CPC)  
  - Scanning mobility particle sizer (SMPS)  
  - Diethlyeneglycol- Scanning mobility particle sizer (DEG-SMPS)  
  - Optical particle counter (OPC)  
  - Aethalometer (Measurement of BC mass concentration and absorption coefficient)  
  - Organic and elemental carbons (OC/EC) analyzer  
  - Laser-induced breakdown spectroscopy (LIBS) technique  
  - Construction of the optic chamber for LIBS system  
  - Construction of face mask and filter test measurement system  
  - Lab-scale particle generation using Atomizer  

- **Computer Programming & Software**  
  - Machine/deep learning techniques using R  
  - Air mass backward trajectory analysis (HYSPLIT) using R  
  - Spatiotemporal and Geographic Information System (GIS) data analysis using R  
  - Statistical analysis using R  
  - Data collection based on Application Programming Interface (API) using R  
  - Image pretreatment and analysis using R  
</div>
<br>
<br>
<br>


<style>
body.page-about h1 {
  margin-top: 0;
}

body.page-about .container {
  max-width: 100%;
  margin: 0 auto;
  
  background: linear-gradient(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.1)), url("/images/main_bg_2.webp");
  background-repeat: no-repeat;
  background-position: center center;
  background-size: 120% auto;
  background-attachment: fixed;
  transition: background-position 0.2s linear;
}

body.page-about .content {
  max-width: 60%;
}

@media (max-width: 1366px) {

  body.page-about .container {
    min-height: 100vh;
    background-size: cover; 
    background-attachment: scroll !important;
  }
  
  body.page-about .content {
    max-width: 90%;
  }
  
}
</style>

<script>
window.addEventListener("scroll", function() {
  const container = document.querySelector("body.page-about .container");
  if (container) {
    let scrollY = window.pageYOffset;
    let moveX = 50 - (scrollY * 0.01); 
    container.style.backgroundPosition = moveX + "% center";
  }
});
</script>


<div class="projects-container reveal-on-scroll">
  
  <div class="projects-center-core">
    <h1 style="font-size: 5rem; font-weight: bold; text-align: center; color: white; text-shadow: 0 0.2rem 0.5rem var(--color-black);" >
      Projects
    </h1>
  </div>

  <div class="projects-orbit-item item-1" onclick="openModalProjects('projects-modal-1')">
    <img src="/images/project_1.webp" alt="Wildfire Project">
    <div class="label">Wildfire & Air Quality</div>
  </div>

  <div class="projects-orbit-item item-2" onclick="openModalProjects('projects-modal-2')">
    <img src="/images/project_2.webp" alt="PM2.5 Study">
    <div class="label">PM2.5 Characteristics</div>
  </div>

  <div class="projects-orbit-item item-3" onclick="openModalProjects('projects-modal-3')">
    <img src="/images/project_3.webp" alt="NPF Study">
    <div class="label">New Particle Formation</div>
  </div>

  <div class="projects-orbit-item item-4" onclick="openModalProjects('projects-modal-4')">
    <img src="/images/project_4.webp" alt="LIBS System">
    <div class="label">LIBS System Development</div>
  </div>
  
  <div class="projects-orbit-item item-5" onclick="openModalProjects('projects-modal-5')">
    <div class="label">Resources</div>
  </div>
</div>


<div id="projects-modal-1" class="projects-modal-overlay" onclick="closeModalProjects(event, 'projects-modal-1')">
  <div class="projects-modal-content" onclick="event.stopPropagation()">
    <div class="projects-modal-header">
      <h3>Wildfire & Air Quality</h3>
      <button class="projects-close-btn" onclick="closeModalProjects(null, 'projects-modal-1')">&times;</button>
    </div>
    <div class="projects-modal-body">
      <h2>Impact of wildfire smoke on air quality in the United States</h2>
      <hr>
      <p> 
        <b>Objectives</b>: Quantifying the impact of wildfire emissions on surface ozone
        <br>
        <b>Dates of project initiation and completion</b>: 2023.04.–present 
      </p>
      <div style="text-align: center;">
        <img src="/images/project_1.webp" style="margin: 1rem 0;">
      </div>
      <h3>📚 Related Publications</h3>
      <ul style="font-size: 1.2rem;">
        <li><b>Lee, H.</b> and Jaffe, D. A.: 
        Impact of Wildfires on O3 and Air Quality Across the United States for 2019–2024 Using Generalized Additive Models, 
        <em>J. Geophys. Res.: Atmos.</em>, 130, e2025JD044088, 2025.
        <a href="https://doi.org/10.1029/2025JD044088" target="_blank" rel="noopener noreferrer">https://doi.org/10.1029/2025JD044088</a>
        </li>
        <li><b>Lee, H.</b> and Jaffe, D. A.: 
        Wildfire impacts on O3 in the continental United States using PM2.5 and a generalized additive model (2018–2023), 
        <em>Environ. Sci. Technol.</em>, 58, 14764–14774, 2024.
        <a href="https://doi.org/10.1021/acs.est.4c05870" target="_blank" rel="noopener noreferrer">https://doi.org/10.1021/acs.est.4c05870</a>
        </li>
        <li><b>Lee, H.</b> and Jaffe, D. A.: 
        Impact of wildfire smoke on ozone concentrations using a Generalized Additive model in Salt Lake City, Utah, USA, 2006–2022, 
        <em>J. Air Waste Manag. Assoc.</em>, 74, 116–130, 2024.
        <a href="https://doi.org/10.1080/10962247.2023.2291197" target="_blank" rel="noopener noreferrer">https://doi.org/10.1080/10962247.2023.2291197</a>
        </li>
        <li>Jaffe, D. A.,  Ninneman, M., Nguyen, L., <b>Lee, H.</b>, Hu, L., Ketcherside, D., Jin L., Cope, E., Lyman, S., Jones, C., ONeli, T., Mansfield, M. L.: 
        Key results from the Salt Lake regional smoke, ozone and Aerosol study (SAMOZA), 
        <em>J. Air Waste Manag. Assoc.</em>, 74, 163–180, 2024.
        <a href="https://doi.org/10.1080/10962247.2024.2301956" target="_blank" rel="noopener noreferrer">https://doi.org/10.1080/10962247.2024.2301956</a>
        </li>
        <br>
      </ul>
    </div>
  </div>
</div>


<div id="projects-modal-2" class="projects-modal-overlay" onclick="closeModalProjects(event, 'projects-modal-2')">
  <div class="projects-modal-content" onclick="event.stopPropagation()">
    <div class="projects-modal-header">
      <h3>PM2.5 Characteristics</h3>
      <button class="projects-close-btn" onclick="closeModalProjects(null, 'projects-modal-2')">&times;</button>
    </div>
    <div class="projects-modal-body">
      <h2>A study on the comprehensive characteristics of fine particulate matter (PM2.5)</h2>
      <hr>
      <p> 
        <b>Objectives</b>: 
        1) Analyzing the chemical composition, sources, and transport of PM2.5 in winter haze over China and Korea and spring pollution over the Yellow Sea.
        2) Developing advanced classification methods using machine learning to better understand fine particle characteristics and their health impacts.
        3) Evaluating the performance and sustainability of face masks in filtering fine particles under various environmental conditions.
        <br>
        <b>Dates of project initiation and completion</b>: 2017.01.–2022.12. 
      </p>
      <div style="text-align: center;">
        <img src="/images/project_2.webp" style="margin: 1rem 0;">
      </div>
      <h3>📚 Related Publications</h3>
      <ul style="font-size: 1.2rem;">
        <li>Khadgi, J., <b>Lee, H.</b>, Seo, J., Hong, J.-H., and Park, K.: 
        Morphological classification of fine particles in transmission electron microscopy images by using pre-trained convolution neural networks, 
        <em>Aerosol Sci. Technol.</em>, 1–10, 2024. 
        <a href="https://doi.org/10.1080/02786826.2024.2322010" target="_blank" rel="noopener noreferrer">https://doi.org/10.1080/02786826.2024.2322010</a>
        </li>
        <li>Park, M., Lee, S., <b>Lee, H.</b>, Denna, M. C. F. J., Jang, J., Oh, D., Bae, M.-S., Jang, K.-S., and Park, K.: 
        New health index derived from oxidative potential and cell toxicity of fine particulate matter to assess its potential health effect, 
        <em>Heliyon</em>, 10 (3), e25310, 2024. 
        <a href="https://doi.org/10.1016/j.heliyon.2024.e25310" target="_blank" rel="noopener noreferrer">https://doi.org/10.1016/j.heliyon.2024.e25310</a>
        </li>
        <li><b>Kwak, N., Lee, H.</b>, Maeng, H., Seo, A., Lee, K., Kim, S., Lee, M., Cha, J. W., Shin, B., and Park, K.: 
        Morphological and chemical classification of fine particles over the Yellow Sea during spring, 2015–2018, 
        <em>Environ. Pollut.</em>, 305, 119286, 2022. 
        <a href="https://doi.org/10.1016/j.envpol.2022.119286" target="_blank" rel="noopener noreferrer">https://doi.org/10.1016/j.envpol.2022.119286</a>
        </li>
        <li><b>Lee, H.</b>, Kim, S., Joo, H., Cho, H.-J., and Park, K.: 
        A study on Performance and Reusability of Certified and Uncertified Face Masks, 
        <em>Aerosol Air Qual. Res.</em>, 22, 210370, 2022. 
        <a href="https://doi.org/10.4209/aaqr.210370" target="_blank" rel="noopener noreferrer">https://doi.org/10.4209/aaqr.210370</a>
        </li>
        <li>Eom, S., <b>Lee, H.</b>, Kim, J., Park, K., Kim, Y., Sheu, G.-R., Gay, D. A., Schmeltz, D., and Han, S.: 
        Potential sources, scavenging processes, and source regions of mercury in the wet deposition of South Korea, 
        <em>Sci. Total Environ.</em>, 762, 143934, 2021. 
        <a href="https://doi.org/10.1016/j.scitotenv.2020.143934" target="_blank" rel="noopener noreferrer">https://doi.org/10.1016/j.scitotenv.2020.143934</a>
        </li>
        <li>Park, M., Wang, Y., Chong, J., <b>Lee, H.</b>, Jang, J., Song, H., Kwak, N., Borlaza, L. J. S., Maeng, H., Cosep, E. M. R., Denna, M. C. F. J., Chen, S., Seo, I., Bae, M.-S., Jang, K.-S., Choi, M., Kim, Y. H., Park, M., Ryu, J.-S., Park, S., Hu, M., and Park, K.: 
        Simultaneous measurements of chemical characteristics and oxidative potential of fine particles during winter haze period in urban sites in China and Korea, 
        <em>Atmosphere</em>, 11, 292, 2020. 
        <a href="https://doi.org/10.3390/atmos11030292" target="_blank" rel="noopener noreferrer">https://doi.org/10.3390/atmos11030292</a>
        </li>
        <br>
      </ul>
    </div>
  </div>
</div>


<div id="projects-modal-3" class="projects-modal-overlay" onclick="closeModalProjects(event, 'projects-modal-3')">
  <div class="projects-modal-content" onclick="event.stopPropagation()">
    <div class="projects-modal-header">
      <h3>New Particle Formation (NPF)</h3>
      <button class="projects-close-btn" onclick="closeModalProjects(null, 'projects-modal-3')">&times;</button>
    </div>
    <div class="projects-modal-body">
      <h2>A study on new particle formation (NPF) in the ambient atmosphere</h2>
      <hr>
      <p> 
        <b>Objectives</b>: Identifying differences of characteristics and governing factors for the NPF among sites
        <br>
        <b>Dates of project initiation and completion</b>: 2018.01.–2022.12. 
      </p>
      <div style="text-align: center;">
        <img src="/images/project_3.webp" style="margin: 1rem 0;">
      </div>
      <h3>📚 Related Publications</h3>
      <ul style="font-size: 1.2rem;">
        <li><b>Lee, H.</b>, Cho, H., Kim, J., Yoon, Y. J., Lee, B. Y., and Park, K.: 
        Comparison of new particle formation events in urban, agricultural, and Arctic environments, 
        <em>Atmos. Environ.</em>, 120634, 2024.
        <a href="https://doi.org/10.1016/j.atmosenv.2024.120634" target="_blank" rel="noopener noreferrer">https://doi.org/10.1016/j.atmosenv.2024.120634</a>
        </li>
        <li><b>Lee, H.</b>, Lee, K., Krejci, R., Fiebig, M., Lunder, C. R., Aas, W., Park, J., Park, K.-T., Lee, B. Y., Yoon, Y.-J., and Park, K.:
        Atmospheric new particle formation characteristics in the Arctic as measured at Mount Zeppelin, Svalbard, from 2016 to 2018,
        <em>Atmos. Chem. Phys.</em>, 20, 13425–13441, 2020.
        <a href="https://doi.org/10.5194/acp-20-13425-2020" target="_blank" rel="noopener noreferrer">https://doi.org/10.5194/acp-20-13425-2020</a>
        </li>
        <br>
      </ul>
    </div>
  </div>
</div>


<div id="projects-modal-4" class="projects-modal-overlay" onclick="closeModalProjects(event, 'projects-modal-4')">
  <div class="projects-modal-content" onclick="event.stopPropagation()">
    <div class="projects-modal-header">
      <h3>LIBS System Development</h3>
      <button class="projects-close-btn" onclick="closeModalProjects(null, 'projects-modal-4')">&times;</button>
    </div>
    <div class="projects-modal-body">
      <h2>Development of laser-induced breakdown spectroscopy (LIBS) system</h2>
      <hr>
      <p> 
        <b>Objectives</b>: Exploring the potential of LIBS technique in analyzing elements in flowback water from fracking operations and in detecting contamination particles in industrial processes
        <br>
        <b>Dates of project initiation and completion</b>: 2017.03.–2020.02. 
      </p>
      <div style="text-align: center;">
        <img src="/images/project_4.webp" style="margin: 1rem 0;">
      </div>
      <h3>📚 Related Publications</h3>
      <ul style="font-size: 1.2rem;">
        <li><b>Lee, H.</b>, Kim, G., Kim, H.-A., Maeng, H., Park, H., and Park, K.: 
        Application of laser-induced breakdown spectroscopy for detection of elements in flowback water samples from shale gas wells, 
        <em>Applied Optics</em>, 59, 2254–2261, 2020.
        <a href="https://doi.org/10.1364/AO.381687" target="_blank" rel="noopener noreferrer">https://doi.org/10.1364/AO.381687</a>
        </li>
        <li>Kim, G., Kim, K., Maeng, H., <b>Lee, H.</b>, and Park, K.:
        Development of Aerosol-LIBS (Laser-Induced Breakdown Spectroscopy) for Real-time Monitoring of Process-induced Particles,
        <em>Aerosol and Air Quality Research</em>, 19, 455–460, 2019.
        <a href="https://doi.org/10.4209/aaqr.2018.08.0312" target="_blank" rel="noopener noreferrer">https://doi.org/10.4209/aaqr.2018.08.0312</a>
        </li>
        <li><b>Lee, H.</b>, Maeng, H., Kim, K., Kim, G., and Park, K.:
        Application of laser-induced breakdown spectroscopy for real-time detection of contamination particles during the manufacturing process,
        <em>Applied Optics</em>, 57 (12), 3288–3292, 2018.
        <a href="https://doi.org/10.1364/AO.57.003288" target="_blank" rel="noopener noreferrer">https://doi.org/10.1364/AO.57.003288</a>
        </li>
        <li>Maeng, H., Chae, H., Lee, H., Kim, G., <b>Lee, H.</b>, Kim, K., Kwak, J., Cho, G., and Park, K.:
        Development of laser-induced breakdown spectroscopy (LIBS) with times ablation to improve detection efficiency,
        <em>Aerosol Science and Technology</em>, 51, 1009–1015, 2017.
        <a href="https://doi.org/10.1080/02786826.2017.1344352" target="_blank" rel="noopener noreferrer">https://doi.org/10.1080/02786826.2017.1344352</a>
        </li>
        <br>
      </ul>
    </div>
  </div>
</div>


<div id="projects-modal-5" class="projects-modal-overlay" onclick="closeModalProjects(event, 'projects-modal-5')">
  <div class="projects-modal-content" onclick="event.stopPropagation()">
    <div class="projects-modal-header">
      <h3>Resources</h3>
      <button class="projects-close-btn" onclick="closeModalProjects(null, 'projects-modal-5')">&times;</button>
    </div>
    <div class="projects-modal-body">
      <div class="card-about reveal-on-scroll">
      <h2 style="font-weight: bold;">For useful data archives </h2>
      <ul style="font-size: 1.6rem;">
        <li>
          <a href="https://www.star.nesdis.noaa.gov/smcd/spb/aq/AerosolWatch/" target="_blank" rel="noopener noreferrer">AerosolWatch:</a>
          Aerosol-related satellite data mapping by NOAA NESDIS STAR: Center for Satellite Applications and Research
        </li>
        <li>
          <a href="https://www.airnowtech.org/index.cfm" target="_blank" rel="noopener noreferrer">AirNow-Tech:</a>
          A platform for analyzing real-time and historical air quality data from the US monitoring network
        </li>
        <li>
          <a href="https://files.airnowtech.org/" target="_blank" rel="noopener noreferrer">AirNow-Tech archive:</a>
          A repository for real-time and historical air quality data from the US monitoring network
        </li>
        <li>
          <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer">Copernicus CAMS:</a>
          Provides global atmospheric composition data, forecasts, and reanalysis from the Copernicus Atmosphere Monitoring Service (CAMS)
        </li>
        <li>
          <a href="https://scihub.copernicus.eu/" target="_blank" rel="noopener noreferrer">Copernicus Hub:</a>
          A portal for accessing satellite imagery and Earth observation data from the Copernicus program
        </li>
        <li>
          <a href="https://aqs.epa.gov/aqsweb/documents/data_api.html" target="_blank" rel="noopener noreferrer">EPA AQS API:</a>
          API intructions for retrieving air quality data collected by the US Environmental Protection Agency (EPA)
        </li>
        <li>
          <a href="https://aqs.epa.gov/aqsweb/airdata/download_files.html" target="_blank" rel="noopener noreferrer">EPA AQS pre-generated data:</a>
          A collection of pre-processed air quality datasets available for bulk download
        </li>
        <li>
          <a href="https://www.epa.gov/air-quality-analysis/pm25-tiering-tool-exceptional-events-analysis" target="_blank" rel="noopener noreferrer">EPA PM2.5 tiering tool:</a>
          A tool for classifying PM2.5 air pollution events based on their severity and regulatory significance
        </li>
        <li>
          <a href="https://mesonet.agron.iastate.edu/ASOS/" target="_blank" rel="noopener noreferrer">IEM ASOS network:</a>
          Iowa Environmental Mesonet (IEM) Automated Surface Observing System (ASOS) Network, "riem" package in R  
        </li>
        <li>
          <a href="https://disc.gsfc.nasa.gov/information/documents?title=Data%20Access" target="_blank" rel="noopener noreferrer">NASA GES DISC:</a>
          A data archive providing global climate, weather, and atmospheric datasets from NASA missions
        </li>
        <li>
          <a href="https://so2.gsfc.nasa.gov/no2/no2_index.html" target="_blank" rel="noopener noreferrer">NASA GSFC:</a>
          A resource for satellite-based NO2 data from NASA’s Goddard Space Flight Center
        </li>
        <li>
          <a href="https://giovanni.gsfc.nasa.gov/giovanni/" target="_blank" rel="noopener noreferrer">NASA Giovanni:</a>
          An online data analysis tool for visualizing and exploring NASA’s atmospheric and climate datasets
        </li>
        <li>
          <a href="https://goldsmr4.gesdisc.eosdis.nasa.gov/data/" target="_blank" rel="noopener noreferrer">NASA MERRA-2 archive:</a>
          A respitory for Modern-Era Retrospective analysis for Research and Applications, Version 2 (MERRA-2)
        </li>
        <li>
          <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA POWER:</a>
          A website for NASA Prediction Of Worldwide Energy Resources (POWER) project
        </li>
        <li>
          <a href="https://www.goes-r.gov/products/baseline-aerosol-opt-depth.html" target="_blank" rel="noopener noreferrer">NOAA GOES-R:</a>
          A website for NOAA Geostationary Operational Environmental Satellites—R Series (GOES-R)
        </li>
        <li>
          <a href="https://console.cloud.google.com/storage/browser/gcp-public-data-goes-16;tab=objects?pageState=(%22StorageObjectListTable%22:(%22f%22:%22%255B%255D%22))&pli=1&prefix=&forceOnObjectsSortingFiltering=false" target="_blank" rel="noopener noreferrer">NOAA GOES-R GG cloud:</a>
          A Googel Cloud for NOAA Geostationary Operational Environmental Satellites—R Series (GOES-R)
        </li>
        <li>
          <a href="https://www.goes-r.gov/products/baseline-aerosol-opt-depth.html" target="_blank" rel="noopener noreferrer">NOAA GOES-R AOD:</a>
          A respitory for NOAA GOES-R Series Advanced Baseline Imager (ABI) Level-2 Aerosol Optical Depth (AOD)
        </li>
        <li>
          <a href="https://registry.opendata.aws/noaa-hrrr-pds/" target="_blank" rel="noopener noreferrer">NOAA HRRR:</a>
          A website for NOAA High-Resolution Rapid Refresh (HRRR) Model
        </li>
        <li>
          <a href="https://www.nco.ncep.noaa.gov/pmb/products/hrrr/hrrr.t00z.wrfsfcf00.grib2.shtml" target="_blank" rel="noopener noreferrer">NOAA HRRR parameters:</a>
          Parameter descriptions for NOAA High-Resolution Rapid Refresh (HRRR) Model
        </li>
        <li>
          <a href="https://www.temis.nl/index.php" target="_blank" rel="noopener noreferrer">TEMIS:</a>
          Tropospheric Emission Monitoring Internet Service (TEMIS)
        </li>
        <li>
          <a href="https://tempo.si.edu/" target="_blank" rel="noopener noreferrer">TEMPO:</a>
          Tropospheric Emissions Monitoring of Pollution (TEMPO)
        </li>
        <li>
          <a href="https://projects.cosmicds.cfa.harvard.edu/tempo-lite/" target="_blank" rel="noopener noreferrer">TEMPO CosmicDS :</a>
          Tropospheric Emissions Monitoring of Pollution (TEMPO) CosmicDS NO2 viewer
        </li>
        <li>
          <a href="https://www.epa.gov/hesc/remote-sensing-information-gateway" target="_blank" rel="noopener noreferrer">TEMPO EPA :</a>
          EPA’s Remote Sensing Information Gateway for TEMPO
        </li>
        <li>
          <a href="https://www.star.nesdis.noaa.gov/atmospheric-composition-training/python_tropomi_level2_download.php#download_files" target="_blank" rel="noopener noreferrer">TROPOMI-L2 NOAA:</a>
          Download TROPOMI Level-2 Data Files from the S5P Data Hub
        </li>
        <li>
          <a href="https://www.star.nesdis.noaa.gov/atmospheric-composition-training/python_tropomi_level2_download.php#download_files" target="_blank" rel="noopener noreferrer">TROPOMI-L2/3 PAL:</a>
          Copernicus Sentinel-5P Product Algorithm Laboratory (S5P-PAL) Data Portal (Level-2 and Level-3)
        </li>
      </ul>
      </div>
      <br>
      <div class="card-about reveal-on-scroll">
      <h2 style="font-weight: bold;">For spatial information </h2>
      <ul style="font-size: 1.6rem;">
        <li>
          <a href="https://www.ncei.noaa.gov/access/monitoring/reference-maps/us-climate-regions" target="_blank" rel="noopener noreferrer">NOAA NCEI Geographical Reference Maps:</a>
          A website for NOAA NCEI Geographical Reference Maps
        </li>
        <li>
          <a href="https://catalog.data.gov/dataset/tiger-line-shapefile-current-nation-u-s-core-based-statistical-areas" target="_blank" rel="noopener noreferrer">US Census Bureau:</a>
          TIGER/Line Shapefile, Current, Nation, US, Core-Based Statistical Areas
        </li>
        <li>
          <a href="https://geodata.bts.gov/datasets/usdot::core-based-statistical-areas/explore?location=34.940269%2C-93.312937%2C4.54" target="_blank" rel="noopener noreferrer">USDOT BTS:</a>
          US Department of Transportation: ArcGIS Online, Core-Based Statistical Areas
        </li>
      </ul>
      </div>
      <br>
      <div class="card-about reveal-on-scroll">
      <h2 style="font-weight: bold;">For wildfire information </h2>
      <ul style="font-size: 1.6rem;">
        <li>
          <a href="https://cwfis.cfs.nrcan.gc.ca/report/archives?year=2013&month=09&day=04&process=Submit" target="_blank" rel="noopener noreferrer">NRC:</a>
          A website for Natural Resources Canada (NRC)
        </li>
        <li>
          <a href="https://www.nifc.gov/fire-information/statistics/wildfires" target="_blank" rel="noopener noreferrer">NIFC:</a>
          A website for National Interagency Fire Center (NIFC)
        </li>
        <li>
          <a href="https://sciencenorthwest.com/cooking-up-pollution-a-study-on-how-gas-stoves-affect-indoor-air-pollution/" target="_blank" rel="noopener noreferrer">Science Northwest:</a>
          A blog on environmental science, air quality, and climate change (Dr. Jaffe, UW)
        </li>
        <li>
          <a href="https://wfeis.mtri.org/home" target="_blank" rel="noopener noreferrer">WFEIS:</a>
          Wildland Fire Emissions Inventory System (WFEIS) - assessments of historical wildland fire emissions across US, Canada, and global boreal regions
        </li>
      </ul>
      </div>
      <br>
      <div class="card-about reveal-on-scroll">
      <h2 style="font-weight: bold;">For models </h2>
      <ul style="font-size: 1.6rem;">
        <li>
          <a href="https://www.epa.gov/scram/aermod-modeling-system-development" target="_blank" rel="noopener noreferrer">EPA AERMOD:</a>
          A Gaussian air dispersion model used for estimating air pollutant concentrations from industrial sources
        </li>
        <li>
          <a href="https://www2.acom.ucar.edu/facility/flexpart" target="_blank" rel="noopener noreferrer">FLEXPART:</a>
          FLEXible PARTicle dispersion model (FLEXPART)
        </li>
        <li>
          <a href="https://uataq.github.io/stilt/#/best-practices" target="_blank" rel="noopener noreferrer">STILT:</a>
          Stochastic Time-Inverted Lagrangian Transport Model v2.x (STILT)
        </li>
      </ul>
      </div>
      <br>
    </div>
  </div>
</div>
<br>
<br>
<br>


<script>
  document.body.classList.add("page-projects");

  function openModalProjects(modalId) {
    document.getElementById(modalId).classList.add("active");
    document.body.style.overflow = "hidden";
  }
  
  function closeModalProjects(event, modalId) {
    if (event) event.preventDefault();
    document.getElementById(modalId).classList.remove("active");
    document.body.style.overflow = "auto";
  }
</script>

<style>
.projects-container {
  position: relative;
  width: 100%;
  min-height: 80vh;
  background-color: transparent;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-main);
  font-family: sans-serif;
}

.projects-center-core {
  z-index: var(--z-projects-center-core);
  margin-bottom: 0;
  text-align: center;
  animation: pulse 3s infinite ease-in-out;
}

.projects-orbit-item {
  z-index: var(--z-projects-orbit-item);
  position: absolute;
  width: 30rem;
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease;
  overflow: hidden;
  background: var(--sidebar-widget-bg);
  box-shadow: 0 0.1rem 1rem var(--text-main);
  border: 0.1rem solid var(--card-shadow);
  border-radius: var(--border-radius-0p8rem);
}

.projects-orbit-item:hover {
  filter: brightness(1.2);
  z-index: var(z-projects-orbit-item-hover);
  border-color: var(--color-bg);
}

.projects-orbit-item img {
  width: 100%;
  height: auto;
  display: block;
  opacity: 0.8;
}

.projects-orbit-item .label {
  padding: 1rem;
  font-size: 1.6rem;
  font-weight: bold;
  text-align: center;
  color: var(--text-main);
}

.projects-orbit-item.item-5 {
  width: auto; 
  max-width: max-content;
  background: transparent;
  border: none;
  border-radius: var(--border-radius-0p8rem);
}

.projects-orbit-item.item-5 .label {
  font-size: 3rem; 
  color: white;
}

.item-1 {
  top: 5%; left: 5%;
  animation: float1 10s ease-in-out infinite;
}
.item-2 {
  top: 10%; right: 5%;
  animation: float2 10s ease-in-out infinite;
}
.item-3 {
  bottom: 10%; left: 10%;
  animation: float3 10s ease-in-out infinite;
}
.item-4 {
  bottom: 5%; right: 10%;
  animation: float4 10s ease-in-out infinite;
}
.item-5 {
  bottom: 46%; right: 17%;
  animation: float5 10s ease-in-out infinite;
}

@keyframes float1 {
  0% { transform: translateX(0) translateY(0) rotate(0deg); }
  25% { transform: translateX(0.5rem) translateY(-0.5rem) rotate(1deg); }
  50% { transform: translateX(-0.5rem) translateY(0.5rem) rotate(-1deg); }
  75% { transform: translateX(0.5rem) translateY(-0.5rem) rotate(1deg); }
  100% { transform: translateX(0) translateY(0) rotate(0deg); }
}
@keyframes float2 {
  0% { transform: translateX(-0.5rem) translateY(-0.5rem); }
  25% { transform: translateX(0.5rem) translateY(-0.5rem); }
  50% { transform: translateX(0.5rem) translateY(0.5rem); }
  75% { transform: translateX(-0.5rem) translateY(0.5rem); }
  100% { transform: translateX(-0.5rem) translateY(-0.5rem); }
}
@keyframes float3 {
  0% { transform: translateX(1rem) translateY(1rem); }
  25% { transform: translateX(-1rem) translateY(1rem); }
  50% { transform: translateX(-1rem) translateY(-1rem); }
  75% { transform: translateX(1rem) translateY(-1rem); }
  100% { transform: translateX(1rem) translateY(1rem); }
}
@keyframes float4 {
  0% { transform: translateX(0.5rem) translateY(-0.5rem) rotate(-1deg); }
  25% { transform: translateX(0) translateY(0) rotate(0deg); }
  50% { transform: translateX(-0.5rem) translateY(0.5rem) rotate(1deg); }
  75% { transform: translateX(0) translateY(0) rotate(0deg); }
  100% { transform: translateX(0.5rem) translateY(-0.5rem) rotate(-1deg); }
}
@keyframes float5 {
  0% { transform: translateX(0) translateY(0) rotate(-20deg); }
  25% { transform: translateX(0.5rem) translateY(-0.5rem) rotate(-20deg); }
  50% { transform: translateX(-0.5rem) translateY(0.5rem) rotate(-20deg); }
  75% { transform: translateX(0.5rem) translateY(-0.5rem) rotate(-20deg); }
  100% { transform: translateX(0) translateY(0) rotate(-20deg); }
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.projects-modal-overlay {
  z-index: var(--z-highest);
  display: none;
  position: fixed;
  top: 0;
  left: 0; 
  width: 100%; 
  height: 100%;
  background: transparent;
  justify-content: center;
  align-items: center;
}

.projects-modal-overlay.active { 
  display: flex; 
}

.projects-modal-header {
  position: sticky;
  top: 0;
  padding: 0.2rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: var(--z-projects-modal-header);
  background: var(--card-shadow);
}

.projects-modal-header h3 {
  color: var(--color-bg);
}

.projects-modal-content {
  width: 50%;
  max-height: calc(100vh - var(--header-height-total) - var(--footer-height-total));
  max-height: calc(100dvh - var(--header-height-total) - var(--footer-height-total));
  overflow-y: auto;
  position: relative;
  padding: 0;
  background: var(--color-bg);
  color: var(--text-main);
  box-shadow: 0 2rem 5rem rgba(0,0,0,0.5);
  animation: slideUp 0.2s ease;
}

.projects-modal-body {
  padding: 2rem;
  line-height: 1.6;
}

.projects-modal-body h2 {
  margin-top: 0;
}

.projects-close-btn {
  color: var(--color-bg);
  background: none;
  border: none;
  font-size: 3rem;
  cursor: pointer;
  line-height: 1;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(5rem); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1366px) {

  .projects-container { 
    flex-direction: column; 
    height: auto; 
    padding: 1rem 0; 
  }
  
  .projects-orbit-item { 
    position: relative;
    margin: 1rem 0; 
    padding: 0.2rem 1rem;
    top: auto !important; 
    left: auto !important; 
    right: auto !important;
    bottom: auto !important;
    max-width: max-content;
  }
  
  .projects-orbit-item img {
    display: none;
  }

  .projects-modal-content {
    width: 100%;
  }
  
  .projects-center-core,
  .item-1, .item-2, .item-3, .item-4, .item-5 {
    animation: none;
  }

}
</style>

