/**
 * JO 7110.65 / AIM / CFR citations used by the Vector-to-Final and multiplayer
 * foundation code. Verified against FAA Order JO 7110.65BB with Change 3
 * (effective 7/9/2026) HTML/PDF on faa.gov, the companion Pilot/Controller
 * Glossary (same effective date), and 14 CFR / AIM tables as noted.
 *
 * Source index (retrieved for this work; re-check before classroom events):
 * - https://www.faa.gov/air_traffic/publications/atpubs/atc_html/
 * - https://www.faa.gov/documentLibrary/media/Order/7110.65BB_Bsc_w_Chg_1_2_and_3_dtd_7-9-26_Final.pdf
 * - https://www.faa.gov/air_traffic/publications/atpubs/pcg_html/
 * - AIM TBL 3-3-3 / 14 CFR §91.179 (IFR cruising altitude / magnetic course)
 */

export const ORDER = 'JO 7110.65BB Chg 3 (eff. 7/9/2026)' as const;

export const CITATIONS = {
  /** Vectors to final: ≥2 NM outside approach gate (exceptions), GS altitude. */
  vectorsToFinal: 'JO 7110.65BB 5-9-1',
  /** Max intercept angle vs distance to approach gate (TBL 5-9-1). */
  interceptAngle: 'JO 7110.65BB 5-9-2 / TBL 5-9-1',
  /** Arrival instructions / approach clearance phraseology examples. */
  arrivalInstructions: 'JO 7110.65BB 5-9-4',
  /** Approach clearance procedures (name of approach, fix ≥3 NM before FAF). */
  approachClearance: 'JO 7110.65BB 4-8-1',
  /** No ATC speed assignment inside FAF on final or within 5 NM of runway. */
  speedLimits: 'JO 7110.65BB 5-7-1',
  /** Terminal CWT wake minima (Categories A–I). */
  wakeMinima: 'JO 7110.65BB 5-5-4 (TBL directly-behind / on-approach)',
  /** P/CG definition of approach gate (1 NM outside FAF, ≥5 NM from threshold). */
  approachGate: 'Pilot/Controller Glossary — APPROACH GATE',
  /** P/CG Aircraft Wake Categories A–I weight/class groupings. */
  wakeCategories: 'Pilot/Controller Glossary — AIRCRAFT WAKE CATEGORIES',
  /** Direction-of-flight odd/even thousands (magnetic course). */
  directionAltitude: '14 CFR §91.179 / AIM TBL 3-3-3 (Class G IFR altitudes)',
} as const;
