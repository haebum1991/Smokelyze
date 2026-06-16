
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
export const BREAKS_HRRR_ugm2 = [250, 1000, 5000, 10000, 20000, 40000, 60000];
export const BREAKS_HRRR_ugm3 = [1, 5, 10, 20, 30, 40, 50];

// --------------------------------------------------------
// Label definitions
// --------------------------------------------------------
export const LABEL_SMOKE = ["light", "medium", "heavy"];
export const LABEL_BIN = ["No", "Yes"];
export const LABEL_SMO = ["No", "with minimal SMO", "with significant SMO"];
export const LABEL_SMP = ["No", "with smoke PM2.5=0", "with smoke PM2.5>0"];

