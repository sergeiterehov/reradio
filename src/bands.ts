export type Modulation = "AM" | "FM" | "SSB" | "CW" | "Digital" | "USB" | "LSB" | string;

export interface FrequencyChannel {
  /** Channel number (if defined by standard) */
  channel?: number;
  /** Center frequency in Hertz (Hz) */
  frequencyHz: number;
  /** Optional description of the channel purpose */
  description?: string;
  /** Primary modulation types used in this band */
  modulation?: Modulation[];
}

export interface FrequencyBand {
  /** Unique identifier (e.g., 'HAM_40M', 'PMR446') */
  id: string;
  /** Human-readable name in English */
  name: string;
  /** Brief description in English */
  description: string;
  /** Lower bound of the band in Hz */
  minHz: number;
  /** Upper bound of the band in Hz */
  maxHz: number;
  /** Primary modulation types used in this band */
  modulation: Modulation[];
  /** Channel spacing in Hz (undefined if band is continuous or not channelized) */
  channelStepHz?: number;
  /** Predefined channels (if any) */
  channels?: FrequencyChannel[];
  /** Important legal, regulatory, or technical remarks */
  remarks?: string;
}

/**
 * Radio frequency bands from 10 kHz to 1.5 GHz (1_500_000_000 Hz).
 * All frequencies in Hertz (Hz).
 */
export const RADIO_FREQUENCY_BANDS: FrequencyBand[] = [
  // === PMR446 (Europe) ===
  {
    id: "PMR446",
    name: "PMR446",
    description: "License-free personal mobile radio in Europe.",
    minHz: 446_000_000,
    maxHz: 446_200_000,
    modulation: ["FM", "Digital (DMR/dPMR)"],
    channelStepHz: 12_500,
    channels: [
      // Analog FM channels (8)
      ...Array.from({ length: 8 }, (_, i) => ({
        channel: i + 1,
        frequencyHz: 446_006_250 + i * 12_500,
        modulation: ["FM"],
      })),
      // Digital FDMA channels (8)
      ...Array.from({ length: 8 }, (_, i) => ({
        channel: i + 9,
        frequencyHz: 446_103_125 + i * 12_500,
        modulation: ["Digital (DMR/dPMR)"],
      })),
      // Digital TDMA channels (8, same frequencies as analog but time-shared)
    ],
    remarks:
      "License-free in EU/CEPT countries. Max power: 0.5 W. Not permitted in US/Canada. Digital modes use DMR/dPMR standards. Channels 1–8: analog FM; 9–16: digital FDMA.",
  },

  // === FRS/GMRS (USA/Canada) ===
  {
    id: "FRS_GMRS",
    name: "FRS/GMRS (Family Radio Service / General Mobile Radio Service)",
    description: "Shared UHF personal radio service in North America.",
    minHz: 462_562_500,
    maxHz: 467_712_500,
    modulation: ["FM"],
    channelStepHz: 25_000, // FRS uses 12.5 kHz effective, but 25 kHz spacing
    channels: [
      // FRS/GMRS shared channels 1–7
      ...Array.from({ length: 7 }, (_, i) => ({
        channel: i + 1,
        frequencyHz: 462_562_500 + i * 25_000,
      })),
      // FRS-only channels 8–14
      ...Array.from({ length: 7 }, (_, i) => ({
        channel: i + 8,
        frequencyHz: 467_562_500 + i * 25_000,
      })),
      // GMRS repeater inputs/outputs (15–22)
      { channel: 15, frequencyHz: 462_550_000 },
      { channel: 16, frequencyHz: 462_575_000 },
      { channel: 17, frequencyHz: 462_600_000 },
      { channel: 18, frequencyHz: 462_625_000 },
      { channel: 19, frequencyHz: 462_650_000 },
      { channel: 20, frequencyHz: 462_675_000 },
      { channel: 21, frequencyHz: 462_700_000 },
      { channel: 22, frequencyHz: 462_725_000 },
    ],
    remarks:
      "FRS: license-free, max 2W (channels 1–7), 0.5W (8–14). GMRS: requires FCC license (US), up to 50W. Channels 15–22 are for GMRS repeaters (input shifted by ±5 MHz).",
  },

  // === Airband (VHF Aircraft) ===
  {
    id: "AIR_BAND",
    name: "Aircraft VHF Band",
    description: "Civil aviation voice communication.",
    minHz: 108_000_000,
    maxHz: 137_000_000,
    modulation: ["AM"],
    channelStepHz: 25_000, // 8.33 kHz in Europe for high-density areas
    channels: Array.from({ length: 1_160 }, (_, i) => {
      const freq = 108_000_000 + i * 25_000;
      if (freq > 137_000_000) return null;
      return { frequencyHz: freq };
    }).filter(Boolean) as FrequencyChannel[],
    remarks:
      "AM modulation only. 25 kHz spacing globally; 8.33 kHz spacing mandatory in EU above FL195. Licensed use only. Unauthorized transmission illegal and hazardous.",
  },

  // === Marine VHF ===
  {
    id: "MARINE_VHF",
    name: "Marine VHF Band",
    description: "Ship-to-ship and ship-to-shore maritime communication.",
    minHz: 156_000_000,
    maxHz: 174_000_000,
    modulation: ["FM"],
    channelStepHz: 25_000,
    channels: [
      { channel: 16, frequencyHz: 156_800_000, description: "International distress, safety, calling" },
      { channel: 13, frequencyHz: 156_650_000, description: "Bridge-to-bridge navigation" },
      { channel: 70, frequencyHz: 156_525_000, description: "DSC (Digital Selective Calling)" },
      // Add more as needed
    ],
    remarks:
      "Licensed for vessel use. Channel 16 is monitored for emergencies. DSC (Channel 70) uses digital modulation. Power limited to 1–25W depending on operation.",
  },

  // === ISM 2.4 GHz Band ===
  {
    id: "ISM_2_4",
    name: "ISM 2.4 GHz Band",
    description: "Industrial, Scientific and Medical band; used by Wi-Fi, Bluetooth, Zigbee, etc.",
    minHz: 2_400_000_000,
    maxHz: 2_483_500_000,
    modulation: ["Digital: FHSS, DSSS, OFDM"],
    channelStepHz: 5_000_000, // 5 MHz nominal, but varies by protocol
    channels: Array.from({ length: 14 }, (_, i) => {
      const ch = i + 1;
      const freq = 2_402_000_000 + ch * 5_000_000;
      let desc = "";
      if (ch <= 11) desc = "Allowed globally (with power limits)";
      else if (ch === 12 || ch === 13) desc = "Not allowed in US; allowed in EU/Japan";
      else if (ch === 14) desc = "Japan only (11 MHz spacing)";
      return { channel: ch, frequencyHz: freq, description: desc };
    }),
    remarks:
      "License-exempt under low-power rules. Max EIRP: 100 mW (EU), 1 W (US). Channel 14 is 12 MHz above ch13 and only permitted in Japan for DSSS. Widely used → high interference potential.",
  },

  // === Business/Professional Bands (Examples) ===
  {
    id: "BUSINESS_VHF",
    name: "Business VHF Band",
    description: "VHF business radio (e.g., construction, logistics).",
    minHz: 150_000_000,
    maxHz: 174_000_000,
    modulation: ["FM"],
    remarks:
      "Requires license in most countries. Narrowband (12.5 kHz or 6.25 kHz). Not to be confused with marine or public safety bands.",
  },
  {
    id: "BUSINESS_UHF",
    name: "Business UHF Band",
    description: "UHF business radio.",
    minHz: 450_000_000,
    maxHz: 470_000_000,
    modulation: ["FM"],
    remarks: "Licensed use only. Narrowband channels (12.5/6.25 kHz). Avoid consumer FRS/GMRS frequencies.",
  },

  // === LPD433 (Europe) ===
  {
    id: "LPD433",
    name: "LPD433 (Low Power Device)",
    description: "License-free data/voice in 433 MHz band (Europe).",
    minHz: 433_050_000,
    maxHz: 434_790_000,
    modulation: ["AM", "FSK", "OOK"],
    remarks:
      "Max power: 10 mW EIRP. Used for remote controls, alarms, telemetry. Not for voice in most countries. Not permitted in US as primary service.",
  },

  // === ISM 915 MHz (Region 2) ===
  {
    id: "ISM_915",
    name: "ISM 915 MHz Band",
    description: "Industrial, Scientific and Medical band (Region 2).",
    minHz: 902_000_000,
    maxHz: 928_000_000,
    modulation: ["FHSS", "DSSS", "LoRa"],
    remarks:
      "Available only in ITU Region 2 (Americas). Used by LoRa, Zigbee, cordless phones. Max power: 1 W (FHSS) or 4 W (directional). Not available in EU.",
  },

  // === AM Broadcast Band ===
  {
    id: "AM_BROADCAST",
    name: "AM Broadcast Band (Medium Wave)",
    description: "Amplitude modulation broadcast band for medium-wave radio.",
    minHz: 530_000,
    maxHz: 1_710_000,
    modulation: ["AM"],
    channelStepHz: 9_000, // 9 kHz in Region 1, 10 kHz in Region 2
    channels: Array.from({ length: 138 }, (_, i) => {
      const freq = 531_000 + i * 9_000; // ITU Region 1 grid
      return { frequencyHz: freq <= 1_701_000 ? freq : 530_000 + Math.floor(i / 2) * 10_000 };
    }).filter((ch) => ch.frequencyHz >= 530_000 && ch.frequencyHz <= 1_710_000),
    remarks:
      "Channel spacing: 9 kHz (ITU Regions 1 & 3), 10 kHz (Region 2). Licensed broadcasting only. Not for amateur or personal use.",
  },

  // === Shortwave Broadcast Bands (HF) ===
  {
    id: "HF_BROADCAST",
    name: "Shortwave Broadcast Bands",
    description: "International broadcasting in HF spectrum (multiple sub-bands).",
    minHz: 2_300_000,
    maxHz: 26_100_000,
    modulation: ["AM", "SSB", "Digital"],
    remarks:
      "Comprises multiple ITU-allocated broadcast bands (e.g., 49m, 41m, 31m, 25m, 19m, 16m, 13m). AM is common, but DRM (Digital Radio Mondiale) is growing. No fixed channels—continuous tuning.",
  },

  // === Citizens Band (CB) Radio ===
  {
    id: "CB_RADIO",
    name: "Citizens Band (CB) Radio",
    description: "Short-distance personal/business radio service.",
    minHz: 26_965_000,
    maxHz: 27_405_000,
    modulation: ["AM", "FM", "SSB"],
    channelStepHz: 10_000,
    channels: Array.from({ length: 40 }, (_, i) => ({
      channel: i + 1,
      frequencyHz: 26_965_000 + i * 10_000,
    })),
    remarks:
      "40 standard channels. FM CB allowed in EU (CEPT). SSB permitted in many countries (e.g., US, EU). Max power typically 4W (AM), 12W PEP (SSB). License-free in most regions, but usage rules vary.",
  },

  // === VHF FM Broadcast Band ===
  {
    id: "FM_BROADCAST",
    name: "FM Broadcast Band",
    description: "VHF frequency modulation broadcast band for audio radio.",
    minHz: 87_500_000,
    maxHz: 108_000_000,
    modulation: ["FM"],
    channelStepHz: 100_000, // 200 kHz spacing, center-to-center
    channels: Array.from({ length: 206 }, (_, i) => ({
      channel: i + 1,
      frequencyHz: 87_500_000 + i * 100_000,
    })),
    remarks:
      "200 kHz channel spacing (center frequencies). Japan uses 76–90 MHz. Broadcasting requires license. Receivers typically tune continuously; channels are for planning.",
  },

  // === Amateur (Ham) Radio Bands ===
  {
    id: "HAM_160M",
    name: "160 Meter Amateur Band",
    description: "Top band for amateur radio (MF).",
    minHz: 1_800_000,
    maxHz: 2_000_000,
    modulation: ["CW", "SSB", "Digital"],
    remarks: "ITU Region 1: 1.810–2.000 MHz; Region 2: 1.800–2.000 MHz. Primarily CW and SSB. Nighttime propagation.",
  },
  {
    id: "HAM_80M",
    name: "80 Meter Amateur Band",
    description: "Regional nighttime communication.",
    minHz: 3_500_000,
    maxHz: 4_000_000,
    modulation: ["CW", "SSB", "Digital"],
    remarks: "Region 1: 3.500–3.800 MHz (SSB above 3.600); Region 2: 3.500–4.000 MHz. SSB common above 3.6 MHz.",
  },
  {
    id: "HAM_40M",
    name: "40 Meter Amateur Band",
    description: "Global day/night DX band.",
    minHz: 7_000_000,
    maxHz: 7_300_000,
    modulation: ["CW", "SSB", "Digital"],
    remarks: "Region 1: 7.000–7.200 MHz; Region 2/3: 7.000–7.300 MHz. CW below ~7.1 MHz, SSB above.",
  },
  {
    id: "HAM_20M",
    name: "20 Meter Amateur Band",
    description: "Most popular DX band.",
    minHz: 14_000_000,
    maxHz: 14_350_000,
    modulation: ["CW", "SSB", "Digital"],
    remarks: "Global allocation: 14.000–14.350 MHz. CW below 14.100, SSB above. Excellent daytime propagation.",
  },
  {
    id: "HAM_15M",
    name: "15 Meter Amateur Band",
    description: "Solar-cycle-dependent DX band.",
    minHz: 21_000_000,
    maxHz: 21_450_000,
    modulation: ["CW", "SSB", "Digital"],
    remarks: "21.000–21.450 MHz globally. Best during high solar activity.",
  },
  {
    id: "HAM_10M",
    name: "10 Meter Amateur Band",
    description: "Wideband modes and sporadic-E propagation.",
    minHz: 28_000_000,
    maxHz: 29_700_000,
    modulation: ["CW", "SSB", "FM", "Digital"],
    channels: [
      { frequencyHz: 28_070_000, description: "DX SSB calling" },
      { frequencyHz: 28_120_000, description: "Beacons" },
      { frequencyHz: 29_600_000, description: "FM simplex (Region 2)" },
    ],
    remarks:
      "28.000–29.700 MHz. Includes FM (29.5–29.7 MHz in Region 2). Open during solar peaks. Technician licensees have limited privileges in US.",
  },
  {
    id: "HAM_6M",
    name: "6 Meter Amateur Band",
    description: 'VHF "magic band" with sporadic long-distance propagation.',
    minHz: 50_000_000,
    maxHz: 54_000_000,
    modulation: ["CW", "SSB", "FM", "Digital"],
    channels: [
      { frequencyHz: 50_110_000, description: "CW/Digital" },
      { frequencyHz: 50_125_000, description: "Beacons" },
      { frequencyHz: 52_525_000, description: "FM simplex (US)" },
    ],
    remarks: "50–54 MHz (Region 2); 50–52 MHz (Region 1). FM common near top end. Technician+ license in US.",
  },
  {
    id: "HAM_2M",
    name: "2 Meter Amateur Band",
    description: "Most popular VHF amateur band.",
    minHz: 144_000_000,
    maxHz: 148_000_000,
    modulation: ["FM", "SSB", "CW", "Digital"],
    channels: [
      { frequencyHz: 144_390_000, description: "APRS (packet)" },
      { frequencyHz: 145_000_000, description: "Simplex (Region 1)" },
      { frequencyHz: 146_520_000, description: "National FM simplex (US)" },
    ],
    remarks:
      "Region 1: 144–146 MHz; Regions 2/3: 144–148 MHz. FM dominates local comms. Repeaters common. License required.",
  },
  {
    id: "HAM_70CM",
    name: "70 cm Amateur Band",
    description: "Popular UHF amateur band for repeaters and data.",
    minHz: 420_000_000,
    maxHz: 450_000_000,
    modulation: ["FM", "Digital", "ATV"],
    channels: [
      { frequencyHz: 432_000_000, description: "Weak-signal/CW" },
      { frequencyHz: 439_500_000, description: "Repeater input example" },
      { frequencyHz: 444_000_000, description: "Repeater output example" },
    ],
    remarks:
      "Region 2: 420–450 MHz; overlaps with radar (requires coordination). Region 1: 430–440 MHz. ATV (analog TV) in upper segment in US. License required.",
  },
  {
    id: "HAM_23CM",
    name: "23 cm Amateur Band",
    description: "UHF/microwave amateur band.",
    minHz: 1_240_000_000,
    maxHz: 1_300_000_000,
    modulation: ["FM", "Digital", "ATV", "SSB"],
    remarks:
      "1.24–1.30 GHz globally (some restrictions near 1.3 GHz due to satellite/radio astronomy). License required. Often used for high-speed data and satellite uplinks.",
  },
];

// Utility: Filter bands within 10 kHz – 1.5 GHz
const MIN_FREQ_HZ = 10_000;
const MAX_FREQ_HZ = 1_500_000_000;

export const RADIO_FREQUENCY_BANDS_FILTERED = RADIO_FREQUENCY_BANDS.filter(
  (band) => band.maxHz >= MIN_FREQ_HZ && band.minHz <= MAX_FREQ_HZ
);
