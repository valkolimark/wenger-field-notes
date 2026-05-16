// Static school data for the field app. Source of truth:
// docs/California Private School- LA and Architects.docx (47 schools).
//
// Coordinates are STATIC, hand-derived from the source addresses (best
// judgment) — no runtime geocoding. Entries whose address is ambiguous
// (multi-site / district / address-city mismatch) use a city/area centroid
// and are marked `// TODO: verify coords` for later review.
//
// `enrollment` is kept verbatim from the source (values are qualitative or
// estimated and sometimes non-numeric, e.g. "Included within BMHS").

export type Tier = "tier1" | "core" | "catholic" | "expanded";

export const TIER_LABELS: Record<Tier, string> = {
  tier1: "Tier 1 — Strong Music & Athletics",
  core: "Core Independent / College Prep",
  catholic: "Catholic / Faith-Based",
  expanded: "Expanded Independent + Regional",
};

export interface School {
  /** Stable kebab-case slug of `name`; used for /form/[schoolId] + keys. */
  id: string;
  name: string;
  address: string;
  city: string;
  /** Verbatim from source — may be non-numeric. */
  enrollment: string;
  tier: Tier;
  /** Construction / project activity — useful sales context. */
  projectActivity: string;
  lat: number;
  lng: number;
}

// Maintained in tier order for readability; the export below is sorted by name.
const SCHOOLS_RAW: School[] = [
  // --- Tier 1 — Strong Music & Athletics ---
  {
    id: "harvard-westlake-school",
    name: "Harvard-Westlake School",
    address: "3700 Coldwater Canyon Ave (also 700 N Faring Rd, Beverly Hills)",
    city: "Studio City",
    enrollment: "~1,600 (est.)",
    tier: "tier1",
    projectActivity:
      "Major project underway: New 17-acre River Park athletic campus; completion targeted Fall 2026",
    lat: 34.1467,
    lng: -118.4009,
  },
  {
    id: "brentwood-school-east-campus-6-12",
    name: "Brentwood School-East Campus 6-12",
    address: "100 S Barrington Pl",
    city: "West Los Angeles",
    enrollment: "~1,200",
    tier: "tier1",
    projectActivity: "Long-term master plan: Phased expansion through 2040",
    lat: 34.0533,
    lng: -118.4717,
  },
  {
    id: "loyola-high-school",
    name: "Loyola High School",
    address: "1901 Venice Blvd",
    city: "Los Angeles",
    enrollment: "~1,200 (est.)",
    tier: "tier1",
    projectActivity:
      "Recent + ongoing upgrades: science hall, academic center, master planning",
    lat: 34.0397,
    lng: -118.2876,
  },
  {
    id: "flintridge-preparatory-school",
    name: "Flintridge Preparatory School",
    address: "4543 Crown Ave",
    city: "La Cañada Flintridge",
    enrollment: "~530",
    tier: "tier1",
    projectActivity:
      "Continuous upgrades: STEAM building + campus renovations",
    lat: 34.2049,
    lng: -118.2186,
  },
  {
    id: "sierra-canyon-school",
    name: "Sierra Canyon School",
    address: "20801 Rinaldi St",
    city: "Chatsworth",
    enrollment: "~1,100",
    tier: "tier1",
    projectActivity: "Recent + ongoing: arts center + athletics expansion",
    lat: 34.2769,
    lng: -118.579,
  },
  {
    id: "crossroads-school",
    name: "Crossroads School",
    address: "1714 21st St",
    city: "Santa Monica",
    enrollment: "~1,200",
    tier: "tier1",
    projectActivity:
      "Active construction: 55,000 SF Performing Arts Center (~2026)",
    lat: 34.0228,
    lng: -118.4783,
  },
  {
    id: "windward-school",
    name: "Windward School",
    address: "11350 Palms Blvd",
    city: "West Los Angeles",
    enrollment: "~625",
    tier: "tier1",
    projectActivity:
      "Master plan: campus rebuild + performing arts expansion",
    lat: 34.0079,
    lng: -118.431,
  },
  {
    id: "campbell-hall-school",
    name: "Campbell Hall School",
    address: "4533 Laurel Canyon Blvd",
    city: "Studio City / North Hollywood",
    enrollment: "~1,100",
    tier: "tier1",
    projectActivity: "No major recent projects identified",
    lat: 34.153,
    lng: -118.396,
  },
  {
    id: "viewpoint-school",
    name: "Viewpoint School",
    address: "23620 Mulholland Hwy",
    city: "Calabasas",
    enrollment: "~1,200",
    tier: "tier1",
    projectActivity: "No major current projects identified",
    lat: 34.1389,
    lng: -118.658,
  },
  {
    id: "the-webb-schools",
    name: "The Webb Schools",
    address: "1175 W Base Line Rd",
    city: "Claremont",
    enrollment: "~405",
    tier: "tier1",
    projectActivity: "No major active expansion noted",
    lat: 34.1118,
    lng: -117.718,
  },
  {
    id: "oaks-christian-school",
    name: "Oaks Christian School",
    address: "31749 La Tienda Dr",
    city: "Westlake Village",
    enrollment: "~1,500 (est.)",
    tier: "tier1",
    projectActivity: "Active expansion: New TK–3 campus opening 2026",
    lat: 34.1455,
    lng: -118.766,
  },
  {
    id: "marymount-high-school",
    name: "Marymount High School",
    address: "10643 Sunset Blvd",
    city: "Los Angeles",
    enrollment: "~310",
    tier: "tier1",
    projectActivity:
      "Facility upgrades: science labs + arts renovations",
    lat: 34.0739,
    lng: -118.486,
  },

  // --- Core Independent / College Prep ---
  {
    id: "westridge-school",
    name: "Westridge School",
    address: "324 Madeline Dr",
    city: "Pasadena",
    enrollment: "~550",
    tier: "core",
    projectActivity:
      "Ongoing campus improvements: multi-phase expansion incl. science center + campus growth plan",
    lat: 34.133,
    lng: -118.153,
  },
  {
    id: "archer-school-for-girls",
    name: "Archer School for Girls",
    address: "11725 Sunset Blvd, Brentwood",
    city: "Los Angeles",
    enrollment: "~500",
    tier: "core",
    projectActivity:
      "Major master plan: 'Archer Forward' (academic, athletics, arts expansion)",
    lat: 34.0726,
    lng: -118.476,
  },
  {
    id: "oakwood-school",
    name: "Oakwood School",
    address: "11600 Magnolia Blvd (Secondary) / 11230 Moorpark St (Elementary)",
    city: "North Hollywood / Studio City",
    enrollment: "~800 (est.)",
    tier: "core",
    projectActivity: "Incremental upgrades: phased campus improvements",
    lat: 34.164,
    lng: -118.376,
  },
  {
    id: "wildwood-school",
    name: "Wildwood School",
    address:
      "11811 Olympic Blvd (Secondary) / 12201 Washington Pl (Elementary)",
    city: "West Los Angeles",
    enrollment: "~700",
    tier: "core",
    projectActivity:
      "Recently modernized campus: no major active construction",
    lat: 34.029,
    lng: -118.436,
  },
  {
    id: "new-roads-school",
    name: "New Roads School",
    address: "3131 Olympic Blvd",
    city: "Santa Monica",
    enrollment: "~550",
    tier: "core",
    projectActivity:
      "Stable campus: no major current build; prior improvements completed",
    lat: 34.026,
    lng: -118.469,
  },
  {
    id: "pilgrim-school",
    name: "Pilgrim School",
    address: "540 S Commonwealth Ave",
    city: "Los Angeles",
    enrollment: "~328",
    tier: "core",
    projectActivity:
      "No major capital projects identified: program-focused investment",
    lat: 34.064,
    lng: -118.287,
  },
  {
    id: "rolling-hills-prep",
    name: "Rolling Hills Prep",
    address: "1 Rolling Hills Prep Way",
    city: "San Pedro",
    enrollment: "~225",
    tier: "core",
    projectActivity: "No major construction: stable campus footprint",
    lat: 33.748,
    lng: -118.317,
  },
  {
    id: "sequoyah-school",
    name: "Sequoyah School",
    address: "535 S Pasadena Ave",
    city: "Pasadena",
    enrollment: "~350 (est.)",
    tier: "core",
    projectActivity:
      "Limited visibility: no significant current projects identified",
    lat: 34.138,
    lng: -118.156,
  },

  // --- Catholic / Faith-Based ---
  {
    id: "st-john-bosco-hs",
    name: "St. John Bosco HS",
    address: "13640 Bellflower Blvd",
    city: "Bellflower",
    enrollment: "~1,000 (est.)",
    tier: "catholic",
    projectActivity:
      "Ongoing strategic upgrades: long-term campus modernization",
    lat: 33.902,
    lng: -118.127,
  },
  {
    id: "notre-dame-hs-sherman-oaks",
    name: "Notre Dame HS (Sherman Oaks)",
    address: "13645 Riverside Dr",
    city: "Sherman Oaks",
    enrollment: "~1,200",
    tier: "catholic",
    projectActivity:
      "Active expansion: athletics, aquatics, parking; future dining commons",
    lat: 34.156,
    lng: -118.449,
  },
  {
    id: "bishop-montgomery-hs",
    name: "Bishop Montgomery HS",
    address: "5430 Torrance Blvd",
    city: "Torrance",
    enrollment: "~850–900",
    tier: "catholic",
    projectActivity: "Recent investment: STEAM labs + athletics upgrades",
    lat: 33.837,
    lng: -118.338,
  },
  {
    id: "alemany-hs",
    name: "Alemany HS",
    address: "11111 N Alemany Dr",
    city: "Mission Hills",
    enrollment: "~1,300 (est.)",
    tier: "catholic",
    projectActivity: "Incremental upgrades: ongoing campus improvements",
    lat: 34.273,
    lng: -118.457,
  },
  {
    id: "chaminade-college-prep",
    name: "Chaminade College Prep",
    address: "7500 Chaminade Ave",
    city: "West Hills",
    enrollment: "~1,360",
    tier: "catholic",
    projectActivity:
      "Major expansion underway: classroom building, athletics, aquatic center",
    lat: 34.201,
    lng: -118.636,
  },
  {
    id: "louisville-hs",
    name: "Louisville HS",
    address: "22300 Mulholland Dr",
    city: "Woodland Hills",
    enrollment: "~290",
    tier: "catholic",
    projectActivity: "Recent upgrades: innovation lab + campus improvements",
    lat: 34.138,
    lng: -118.616,
  },
  {
    id: "fairmont-prep",
    name: "Fairmont Prep",
    address: "2200 W Sequoia Ave",
    city: "Anaheim",
    enrollment: "~650",
    tier: "catholic",
    projectActivity: "Stable campus: no major current build",
    lat: 33.848,
    lng: -117.954,
  },
  {
    id: "cathedral-high-school",
    name: "Cathedral High School",
    address: "1253 Bishops Rd",
    city: "Los Angeles",
    enrollment: "~800 (est.)",
    tier: "catholic",
    projectActivity: "Major project completed: performing arts complex",
    lat: 34.071,
    lng: -118.221,
  },
  {
    id: "mayfield-senior-school",
    name: "Mayfield Senior School",
    address: "500 Bellefontaine St",
    city: "Pasadena",
    enrollment: "~330",
    tier: "catholic",
    projectActivity: "Campus improvements: master plan + renovations",
    lat: 34.129,
    lng: -118.149,
  },
  {
    id: "st-francis-hs",
    name: "St. Francis HS",
    address: "200 Foothill Blvd",
    city: "La Cañada Flintridge",
    enrollment: "~900 (est.)",
    tier: "catholic",
    projectActivity: "Ongoing reinvestment: no major current project",
    lat: 34.207,
    lng: -118.198,
  },
  {
    id: "la-salle-college-prep",
    name: "La Salle College Prep",
    address: "3880 E Sierra Madre Blvd",
    city: "Pasadena",
    enrollment: "~600",
    tier: "catholic",
    projectActivity:
      "Long-term master plan: athletics, arts, classroom expansion",
    lat: 34.164,
    lng: -118.084,
  },

  // --- Expanded Independent + Regional ---
  {
    id: "providence-high-school",
    name: "Providence High School",
    address: "511 S Buena Vista St",
    city: "Burbank",
    enrollment: "~400 (est.)",
    tier: "expanded",
    projectActivity:
      "No major capital projects identified: stable campus environment",
    lat: 34.173,
    lng: -118.337,
  },
  {
    id: "ef-academy-pasadena",
    name: "EF Academy Pasadena",
    address: "1539 E Howard St",
    city: "Pasadena",
    enrollment: "~300 (est.)",
    tier: "expanded",
    projectActivity:
      "Newer purpose-built campus: modern facilities with recent development",
    lat: 34.17,
    lng: -118.118,
  },
  {
    id: "southwestern-academy",
    name: "Southwestern Academy",
    address: "2800 Monterey Rd",
    city: "San Marino",
    enrollment: "~200 (est.)",
    tier: "expanded",
    projectActivity:
      "No major construction activity: stable campus footprint",
    lat: 34.111,
    lng: -118.129,
  },
  {
    id: "amerigo-la-bishop-montgomery-campus",
    name: "Amerigo LA (Bishop Montgomery campus)",
    address: "5430 Torrance Blvd",
    city: "Torrance",
    enrollment: "Included within BMHS",
    tier: "expanded",
    projectActivity:
      "Shared campus: utilizes Bishop Montgomery facilities (no separate build)",
    lat: 33.837,
    lng: -118.338,
  },
  {
    id: "the-thacher-school",
    name: "The Thacher School",
    address: "5025 Thacher Rd",
    city: "Ojai",
    enrollment: "~260 (est.)",
    tier: "expanded",
    projectActivity:
      "Ongoing campus upgrades: typical boarding school reinvestment",
    lat: 34.449,
    lng: -119.215,
  },
  {
    id: "idyllwild-arts-academy",
    name: "Idyllwild Arts Academy",
    address: "52500 Temecula Rd",
    city: "Idyllwild",
    enrollment: "~300 (est.)",
    tier: "expanded",
    projectActivity:
      "Continuous arts investment: studios + performance facilities",
    lat: 33.739,
    lng: -116.732,
  },
  {
    id: "fusion-academy-network",
    name: "Fusion Academy (network)",
    address: "Multiple addresses",
    city: "Los Angeles area",
    enrollment: "Small campus model",
    tier: "expanded",
    projectActivity:
      "No traditional builds: micro-campus / leased spaces",
    lat: 34.0522, // TODO: verify coords (network, multiple addresses — LA centroid)
    lng: -118.2437, // TODO: verify coords
  },
  {
    id: "echo-horizon-school",
    name: "Echo Horizon School",
    address: "3430 McManus Ave",
    city: "Culver City",
    enrollment: "~300 (est.)",
    tier: "expanded",
    projectActivity:
      "Recently modernized campus: no major active expansion",
    lat: 34.018,
    lng: -118.396,
  },
  {
    id: "turning-point-school",
    name: "Turning Point School",
    address: "14618 Sylvan St",
    city: "Culver City",
    enrollment: "~300 (est.)",
    tier: "expanded",
    projectActivity:
      "No major public projects identified: incremental improvements only",
    lat: 34.0211, // TODO: verify coords (source address/city mismatch — Culver City centroid)
    lng: -118.3965, // TODO: verify coords
  },
  {
    id: "foothill-country-day-school",
    name: "Foothill Country Day School",
    address: "1035 W Harrison Ave",
    city: "Claremont",
    enrollment: "~350 (est.)",
    tier: "expanded",
    projectActivity:
      "Stable campus: no major current construction activity",
    lat: 34.098,
    lng: -117.728,
  },
  {
    id: "le-lycee-francais-de-la",
    name: "Le Lycée Français de LA",
    address: "3261 Overland Ave (main campus)",
    city: "Los Angeles",
    enrollment: "~1,000+ (est.)",
    tier: "expanded",
    projectActivity:
      "Distributed campuses: periodic upgrades across locations",
    lat: 34.031,
    lng: -118.403,
  },
  {
    id: "immaculate-heart-hs",
    name: "Immaculate Heart HS",
    address: "5515 Franklin Ave",
    city: "Los Angeles",
    enrollment: "~700 (est.)",
    tier: "expanded",
    projectActivity:
      "No major active construction identified: steady reinvestment",
    lat: 34.106,
    lng: -118.311,
  },
  {
    id: "windward-middle-associated-programs",
    name: "Windward Middle / associated programs",
    address: "11350 Palms Blvd",
    city: "Los Angeles",
    enrollment: "Included w/ Windward School",
    tier: "expanded",
    projectActivity:
      "Part of larger campus: tied to Windward expansion + arts investment",
    lat: 34.0079,
    lng: -118.431,
  },
  {
    id: "berkeley-hall-school",
    name: "Berkeley Hall School",
    address: "15700 Mulholland Dr",
    city: "Los Angeles",
    enrollment: "~300 (est.)",
    tier: "expanded",
    projectActivity:
      "Campus modernization completed: no major new projects active",
    lat: 34.113,
    lng: -118.506,
  },
  {
    id: "brentwood-lower-campus-programs",
    name: "Brentwood Lower Campus programs",
    address: "100 S Barrington Pl",
    city: "Los Angeles",
    enrollment: "Included w/ Brentwood School",
    tier: "expanded",
    projectActivity: "Part of master plan: long-term Brentwood expansion",
    lat: 34.0533,
    lng: -118.4717,
  },
  {
    id: "oak-park-independent-regional-feeders",
    name: "Oak Park Independent / regional feeders",
    address: "5801 Conifer St",
    city: "Oak Park",
    enrollment: "~2,000+ (district)",
    tier: "expanded",
    projectActivity:
      "Ongoing public capital improvements: projects vary annually",
    lat: 34.183, // TODO: verify coords (district / regional feeders — Oak Park centroid)
    lng: -118.753, // TODO: verify coords
  },
];

/** All 47 schools, sorted alphabetically by name. */
export const schools: School[] = [...SCHOOLS_RAW].sort((a, b) =>
  a.name.localeCompare(b.name),
);
