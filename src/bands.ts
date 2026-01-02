import { t } from "i18next";

export type NamedBandChannel = {
  number: number;
  freq: number;
  name: string;
};

export type NamedBand = {
  id: string;
  name: string;
  freqMin: number;
  freqMax: number;
  description: string;
  hint: string;
  modulation?: string;
  channels?: NamedBandChannel[];
};

export const bands: NamedBand[] = [
  // MARK: specific
  {
    id: "pmr446",
    name: "PMR446",
    freqMin: 446_001_250,
    freqMax: 446_098_750,
    description: t("band_pmr446_description"),
    hint: t("band_pmr446_hint"),
    modulation: "FM",
    channels: [
      { number: 1, freq: 446_006_250, name: t("pmr_channel_n", { replace: { number: 1 } }) },
      { number: 2, freq: 446_018_750, name: t("pmr_channel_n", { replace: { number: 2 } }) },
      { number: 3, freq: 446_031_250, name: t("pmr_channel_n", { replace: { number: 3 } }) },
      { number: 4, freq: 446_043_750, name: t("pmr_channel_n", { replace: { number: 4 } }) },
      { number: 5, freq: 446_056_250, name: t("pmr_channel_n", { replace: { number: 5 } }) },
      { number: 6, freq: 446_068_750, name: t("pmr_channel_n", { replace: { number: 6 } }) },
      { number: 7, freq: 446_081_250, name: t("pmr_channel_n", { replace: { number: 7 } }) },
      { number: 8, freq: 446_093_750, name: t("pmr_channel_n", { replace: { number: 8 } }) },
    ],
  },
  {
    id: "lpd",
    name: "LPD 433",
    freqMin: 433_050_000,
    freqMax: 434_790_000,
    description: t("band_lpd_description"),
    hint: t("band_lpd_hint"),
    modulation: "FM",
    channels: Array.from({ length: 69 }, (_, i) => {
      const freq = 433_050_000 + i * 25_000;
      return { number: i + 1, freq, name: t(`lpd_channel_n`, { replace: { number: i + 1 } }) };
    }),
  },
  // MARK: common
  {
    id: "70cm",
    name: "70 cm",
    freqMin: 430_000_000,
    freqMax: 440_000_000,
    description: t("band_70cm_description"),
    hint: t("band_70cm_hint"),
  },
  {
    id: "2m",
    name: "2m",
    freqMin: 144_000_000,
    freqMax: 146_000_000,
    description: t("band_2m_description"),
    hint: t("band_2m_hint"),
  },
  {
    id: "10m",
    name: "10m",
    freqMin: 28_000_000,
    freqMax: 29_700_000,
    description: t("band_10m_description"),
    hint: t("band_10m_hint"),
  },
  {
    id: "15m",
    name: "15m",
    freqMin: 21_000_000,
    freqMax: 21_450_000,
    description: t("band_15m_description"),
    hint: t("band_15m_hint"),
  },
  {
    id: "20m",
    name: "20m",
    freqMin: 14_000_000,
    freqMax: 14_350_000,
    description: t("band_20m_description"),
    hint: t("band_20m_hint"),
  },
  {
    id: "40m",
    name: "40m",
    freqMin: 7_000_000,
    freqMax: 7_200_000,
    description: t("band_40m_description"),
    hint: t("band_40m_hint"),
  },
  {
    id: "80m",
    name: "80m",
    freqMin: 3_500_000,
    freqMax: 3_800_000,
    description: t("band_80m_description"),
    hint: t("band_80m_hint"),
  },
  {
    id: "160m",
    name: "160m",
    freqMin: 1_800_000,
    freqMax: 2_000_000,
    description: t("band_160m_description"),
    hint: t("band_160m_hint"),
  },
];
