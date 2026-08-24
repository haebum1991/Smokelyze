
/**
 * 레이어 상수 설정: 레이어 제작에 필요한 색상 팔레트와 수치 범위(Breaks) 등의 고정 데이터를 정의
 */
 
/**
 * Color Palettes and Break definitions for map layers.
 */

export const EMPTY_FC = { type: "FeatureCollection", features: [] };

// --------------------------------------------------------
// Color palette definitions
// --------------------------------------------------------

// [EPA Palette] Green, Yellow, Orange, Red, Purple, Brown
export const PALETTE_EPA = [
    "#00E400", // Green
    "#FFFF00", // Yellow
    "#FF7E00", // Orange
    "#FF0000", // Red
    "#8F3F97", // Purple
    "#7E0023"  // Brown/Maroon
];

// [Jet Palette] R Style: DarkBlue, Blue, Cyan, Yellow, Orange, Red
export const PALETTE_JET = [
    "#00008F", // Dark Blue
    "#0000FF", // Blue
    "#00FFFF", // Cyan
    "#FFFF00", // Yellow
    "#FF7F00", // Orange
    "#FF0000"  // Red
];

// [TEMPO Palette] High-contrast ramp matching NASA's official standard (Vivid version)
export const PALETTE_TEMPO = [
  "#3a57ff", // 1: Bright Blue
  "#3ad9ff", // 25: Electric Cyan
  "#3aff53", // 50: Neon Green
  "#f6ff3a", // 75: Vivid Yellow
  "#ff893a", // 100: Vibrant Orange
  "#ff3a3a", // 125: Pure Red
  "#31004a"  // 150: Deep Purple
];
  
export const PALETTE_GOES_AOD = [
    "#fcfdbf", // Vivid peach gold/light cream (Clear skies)
    "#f89053", // Sunset orange (Thin aerosol)
    "#e35e69", // Coral/salmon red (Moderate)
    "#ba3f7c", // Rose/magenta (Thick)
    "#8c2981", // Raspberry pink (Very thick)
    "#5b106c", // Royal purple (Dangerous/extremely thick)
    "#2c105c"  // Deep twilight purple (Hazardous plume)
];

// [HRRR Smoke Column Mass Density (VCD) Palette] Deep Emerald / Forest Green complementary ramp
export const PALETTE_HRRR_COLMD = [
    "#fde0ef", // 1: Baby Pink (연한 핑크)
    "#f1b6da", // 5: Soft Rose (로즈 핑크)
    "#de77ae", // 10: Vibrant Pink (비비드 핑크)
    "#c51b7d", // 20: Hot Magenta (핫 마젠타)
    "#8e0152", // 40: Rich Ruby (리치 루비)
    "#540030", // 60: Deep Plum (딥 플럼)
    "#290017"  // >= 60: Dark Velvet (다크 벨벳)
];

// [HRRR Palette] Custom smoke color ramp (Gray -> Pale Yellow -> Orange -> Dark Brown)
export const PALETTE_HRRR_SMOKE = [
    "#dcdcdc", // Light Gray
    "#f5e7c8", // Pale Yellow/Cream
    "#f4b455", // Yellow Orange
    "#ec8e30", // Orange
    "#d05c18", // Dark Orange
    "#a4380a", // Reddish Brown
    "#501000"  // Dark Brown
];
  
// [Burn Palette]
export const PALETTE_BURN = [
    "#fee5d9", // Very Light Red
    "#fcae91", // Light Red
    "#fb6a4a", // Medium Red
    "#de2d26", // Dark Red
    "#a50f15"  // Deep Red
];

// [Smoke Palette]
export const PALETTE_SMOKE = [
    "#b0b0b0", // Light
    "#7a7a7a", // Medium 
    "#4a4a4a"  // Heavy
    // "#90EE90", // Light
    // "#DAF76F", // Medium 
    // "#D99052"  // Medium 
];

// [Smoke PM2.5 Palette] Warm orange-red scale to differentiate from Obs PM2.5 EPA scale
export const PALETTE_SMOKE_PM = [
    "#ffdda6", // 0 to 5: Soft Light Orange/Yellow
    "#ffb366", // 5 to 12: Light Orange
    "#ff8000", // 12 to 25: Orange
    "#e65c00", // 25 to 55: Dark Orange
    "#b32400", // 55 to 100: Reddish Brown
    "#730000"  // >= 100: Deep Crimson
];

// [Binary Palette]
export const PALETTE_BIN_1 = [
    "#CCCCCC", // Grey
    "#FF0000"  // Red
];
export const PALETTE_BIN_2 = [
    "#CCCCCC", // Grey
    "#00FF00"  // Green
];
export const PALETTE_BIN_3 = [
    "#CCCCCC", // Grey
    "#0000FF"  // Blue
];
export const PALETTE_TRI = [
    "#CCCCCC", // Grey
    "#00FF00", // Green
    "#FF0000" // Red
];


// [GEOS-CF Palettes]
export const PALETTE_GEOSCF_O3 = [
    "#3a57ff", // Deep Blue (Pristine clean)
    "#3ad9ff", // Cyan (Typical clean background)
    "#3aff53", // Neon Green (Moderate background)
    "#f6ff3a", // Yellow (Elevated photochemical)
    "#ff893a", // Orange (High ozone / Pre-exceedance)
    "#ff3a3a", // Red (NAAQS Exceedance)
    "#31004a"  // Deep Maroon (Extreme plume)
];
export const PALETTE_GEOSCF_CO = [
    "#054d38", // 0: Deep Forest Teal Green (Clean pristine)
    "#288766", // 1: Teal Pine Green
    "#7ec4a6", // 2: Soft Seafoam Green
    "#f3e8c9", // 3: Pale Sand / Vanilla Cream (Mid-level transition)
    "#d79844", // 4: Warm Golden Amber (Elevated plume)
    "#a25d19", // 5: Rich Sienna Brown (Heavy pollution)
    "#5c2e00"  // 6: Deep Chocolate/Chestnut Brown (Extreme fire core)
];
export const PALETTE_GEOSCF_NO2 = [
    "#d0f0fd", // Pristine clean
    "#74c0fc", // Light Blue (Rural)
    "#38d9a9", // Mint/Green (Suburban)
    "#ffd43b", // Yellow (Urban)
    "#ff922b", // Orange (Industrial/Highway)
    "#fa5252", // Red (High pollution)
    "#67001f"  // Deep Burgundy
];
export const PALETTE_GEOSCF_HCHO = [
    "#f7fcf0", // 0: Light Lime Cream (Clean baseline)
    "#c7e9b4", // 1: Spring Mint (Vegetation background)
    "#7fcdbb", // 2: Soft Turquoise
    "#41b6c4", // 3: Electric Cyan-Turquoise (Photochemical active VOCs)
    "#1d91c0", // 4: Bright Ocean Blue
    "#225ea8", // 5: Deep Royal Blue (High VOC plume)
    "#081d58"  // 6: Deep Sapphire / Midnight Navy (Extreme VOC core)
];
export const PALETTE_GEOSCF_PM = [
    "#440154", // 0: Deep Purple / Indigo (Clean baseline)
    "#443983", // 1: Dark Blue-Violet
    "#31688e", // 2: Ocean Teal-Blue
    "#21908d", // 3: Emerald Green
    "#35b779", // 4: Light Viridian Green
    "#8fd744", // 5: Chartreuse / Lime Green
    "#fde725"  // 6: Bright Vivid Yellow (High PM2.5 concentration core)
];
export const PALETTE_GEOSCF_PMOC = [
    "#0d0887", // 0: Deep Midnight Blue (Clean baseline)
    "#5402a3", // 1: Electric Violet
    "#8b0aa5", // 2: Vibrant Purple-Magenta
    "#b93289", // 3: Hot Pink / Magenta
    "#db5c68", // 4: Coral Red
    "#f48849", // 5: Blazing Tangerine Orange
    "#fece2f"  // 6: Glowing Gold (High smoke concentration core)
];

// [AirFuse Palettes]
export const PALETTE_AIRFUSE_PM25 = [
    "#c8ffc8", "#00e400", "#007d00", "#ffffc8", "#ffff00", "#c8c800",
    "#ffbe78", "#ff7e00", "#c86400", "#ff6464", "#ff0000", "#990000",
    "#dca0dc", "#8f3f97", "#4d004d", "#800000", "#500000", "#330000", "#000000"
];
export const PALETTE_AIRFUSE_O3 = [
    "#c8ffc8", "#00e400", "#007d00", "#ffffc8", "#ffff00", "#c8c800",
    "#ffbe78", "#ff7e00", "#c86400", "#ff6464", "#ff0000", "#990000",
    "#dca0dc", "#8f3f97", "#4d004d", "#000000"
];


// --------------------------------------------------------
// Breaks definitions
// --------------------------------------------------------

export const BREAKS_O3 = [55, 71, 86, 106, 201];
export const BREAKS_PM = [9.1, 35.5, 55.5, 125.5, 225.5];
export const BREAKS_SMOKE_PM = [5, 12, 25, 55, 100];
export const BREAKS_PM_CRIT = [5, 7.5, 10, 12.5, 15];
export const BREAKS_NO2 = [10, 20, 30, 40, 50];
export const BREAKS_RESI = [-10, -5, 0, 5, 10];
export const BREAKS_SMO_EMBER = [1, 3, 5, 7, 10];
export const BREAKS_TMAX = [15, 20, 25, 30, 35];
export const BREAKS_T2MAX = [290, 295, 300, 305, 310];
export const BREAKS_SRAD = [200, 250, 300, 350, 400];
export const BREAKS_QUANT = [10, 30, 50, 70, 90];
export const BREAKS_R2 = [0.2, 0.4, 0.55, 0.7, 0.85];
export const BREAKS_BIN = [0.5];
export const BREAKS_TRI = [0.5, 1.5];
export const BREAKS_FIRE = [1, 10, 50, 100, 500];
export const BREAKS_FRP = [10, 50, 150, 350];
export const BREAKS_SMOKE = [1000, 5000, 20000, 50000, 100000];
export const BREAKS_BURN = [10, 50, 100, 500, 1000];
export const BREAKS_TEMPO = [1, 25, 50, 75, 100, 125, 150]; // NASA Standard 7-step linear scale
export const BREAKS_HRRR_ugm2 = [0, 1, 5, 10, 20, 40, 60];
export const BREAKS_HRRR_ugm3 = [0, 1, 5, 10, 20, 40, 60];
export const BREAKS_GOES_AOD = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0];

// [GEOS-CF Breaks]
export const BREAKS_GEOSCF_O3 = [15, 25, 35, 45, 55, 70, 90];
export const BREAKS_GEOSCF_CO = [50, 75, 100, 150, 250, 500, 1000];
export const BREAKS_GEOSCF_NO2 = [0, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0];
export const BREAKS_GEOSCF_HCHO = [0, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0];
export const BREAKS_GEOSCF_PM = [2, 5, 12, 25, 50, 100, 200];
export const BREAKS_GEOSCF_PMOC = [0, 1, 5, 10, 20, 40, 60];

// [AirFuse Breaks]
export const BREAKS_AIRFUSE_PM25 = [
    3.0, 6.0, 9.1, 15.0, 25.0, 35.5, 40.0, 50.0, 55.5,
    75.0, 100.0, 125.5, 150.0, 200.0, 225.5, 325.0, 500.0, 750.0
];
export const BREAKS_AIRFUSE_O3 = [
    30.0, 45.0, 55.0, 60.0, 65.0, 71.0, 75.0, 80.0, 86.0,
    90.0, 100.0, 106.0, 125.0, 175.0, 201.0
];


// --------------------------------------------------------
// Label definitions
// --------------------------------------------------------
export const LABEL_SMOKE = ["light", "medium", "heavy"];
export const LABEL_BIN = ["No", "Yes"];
export const LABEL_SMO = ["No", "with minimal SMO", "with significant SMO"];
export const LABEL_SMP = ["No", "with smoke PM2.5=0", "with smoke PM2.5>0"];

// [AirFuse Label]
export const LABEL_AIRFUSE_PM25 = [
    "< 3.0", "3.0 to < 6.0", "6.0 to < 9.1", "9.1 to < 15.0",
    "15.0 to < 25.0", "25.0 to < 35.5", "35.5 to < 40.0", "40.0 to < 50.0",
    "50.0 to < 55.5", "55.5 to < 75.0", "75.0 to < 100.0", "100.0 to < 125.5",
    "125.5 to < 150.0", "150.0 to < 200.0", "200.0 to < 225.5", "225.5 to < 325.0",
    "325.0 to < 500.0", "500.0 to < 750.0", "> 750.0"
];
export const LABEL_AIRFUSE_O3 = [
    "< 30.0", "30.0 to < 45.0", "45.0 to < 55.0", "55.0 to < 60.0",
    "60.0 to < 65.0", "65.0 to < 71.0", "71.0 to < 75.0", "75.0 to < 80.0",
    "80.0 to < 86.0", "86.0 to < 90.0", "90.0 to < 100.0", "100.0 to < 106.0",
    "106.0 to < 125.0", "125.0 to < 175.0", "175.0 to < 201.0", "> 201.0"
];

