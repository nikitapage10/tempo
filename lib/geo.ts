/**
 * Tiny offline gazetteer.
 *
 * Artist profiles carry a free-text `location` ("Berlin", "Los Angeles, CA",
 * "London, UK") and an optional ISO-3166-1 alpha-2 `country_code`. The Social
 * globe needs coordinates for those, and we don't want a network geocoder in
 * the render path — so this resolves the common cases from a built-in table
 * and gives up quietly on anything it doesn't know.
 *
 * Coordinates are city-centre / country-centroid approximations. The globe is
 * a few hundred pixels wide; sub-degree accuracy is meaningless here.
 */

export type LatLon = [lat: number, lon: number];

/** Music-industry cities first, then general large-metro coverage. */
const CITIES: Record<string, LatLon> = {
  // North America
  "los angeles": [34.05, -118.24],
  la: [34.05, -118.24],
  hollywood: [34.09, -118.33],
  "new york": [40.71, -74.01],
  nyc: [40.71, -74.01],
  brooklyn: [40.68, -73.94],
  manhattan: [40.78, -73.97],
  nashville: [36.16, -86.78],
  atlanta: [33.75, -84.39],
  chicago: [41.88, -87.63],
  detroit: [42.33, -83.05],
  memphis: [35.15, -90.05],
  "new orleans": [29.95, -90.07],
  austin: [30.27, -97.74],
  houston: [29.76, -95.37],
  dallas: [32.78, -96.8],
  miami: [25.76, -80.19],
  seattle: [47.61, -122.33],
  portland: [45.52, -122.68],
  "san francisco": [37.77, -122.42],
  oakland: [37.8, -122.27],
  "san diego": [32.72, -117.16],
  "las vegas": [36.17, -115.14],
  denver: [39.74, -104.99],
  phoenix: [33.45, -112.07],
  minneapolis: [44.98, -93.27],
  philadelphia: [39.95, -75.17],
  boston: [42.36, -71.06],
  washington: [38.91, -77.04],
  "washington dc": [38.91, -77.04],
  baltimore: [39.29, -76.61],
  toronto: [43.65, -79.38],
  montreal: [45.5, -73.57],
  vancouver: [49.28, -123.12],
  ottawa: [45.42, -75.7],
  calgary: [51.05, -114.07],
  "mexico city": [19.43, -99.13],
  guadalajara: [20.67, -103.35],
  monterrey: [25.69, -100.32],
  havana: [23.11, -82.37],
  kingston: [17.97, -76.79],
  "san juan": [18.47, -66.11],

  // South America
  "sao paulo": [-23.55, -46.63],
  "são paulo": [-23.55, -46.63],
  "rio de janeiro": [-22.91, -43.17],
  rio: [-22.91, -43.17],
  "buenos aires": [-34.6, -58.38],
  santiago: [-33.45, -70.67],
  lima: [-12.05, -77.04],
  bogota: [4.71, -74.07],
  "bogotá": [4.71, -74.07],
  medellin: [6.24, -75.58],
  "medellín": [6.24, -75.58],
  caracas: [10.48, -66.9],
  montevideo: [-34.9, -56.16],
  quito: [-0.18, -78.47],

  // UK & Ireland
  london: [51.51, -0.13],
  manchester: [53.48, -2.24],
  liverpool: [53.41, -2.98],
  birmingham: [52.49, -1.89],
  bristol: [51.45, -2.59],
  leeds: [53.8, -1.55],
  sheffield: [53.38, -1.47],
  glasgow: [55.86, -4.25],
  edinburgh: [55.95, -3.19],
  cardiff: [51.48, -3.18],
  belfast: [54.6, -5.93],
  dublin: [53.35, -6.26],
  brighton: [50.82, -0.14],

  // Continental Europe
  berlin: [52.52, 13.4],
  hamburg: [53.55, 9.99],
  munich: [48.14, 11.58],
  cologne: [50.94, 6.96],
  frankfurt: [50.11, 8.68],
  leipzig: [51.34, 12.37],
  paris: [48.86, 2.35],
  marseille: [43.3, 5.37],
  lyon: [45.76, 4.84],
  amsterdam: [52.37, 4.9],
  rotterdam: [51.92, 4.48],
  "the hague": [52.08, 4.31],
  brussels: [50.85, 4.35],
  antwerp: [51.22, 4.4],
  copenhagen: [55.68, 12.57],
  stockholm: [59.33, 18.07],
  gothenburg: [57.71, 11.97],
  oslo: [59.91, 10.75],
  bergen: [60.39, 5.32],
  helsinki: [60.17, 24.94],
  reykjavik: [64.15, -21.94],
  "reykjavík": [64.15, -21.94],
  madrid: [40.42, -3.7],
  barcelona: [41.39, 2.17],
  valencia: [39.47, -0.38],
  seville: [37.39, -5.98],
  lisbon: [38.72, -9.14],
  porto: [41.15, -8.61],
  rome: [41.9, 12.5],
  milan: [45.46, 9.19],
  naples: [40.85, 14.27],
  turin: [45.07, 7.69],
  zurich: [47.38, 8.54],
  geneva: [46.2, 6.14],
  vienna: [48.21, 16.37],
  prague: [50.08, 14.44],
  warsaw: [52.23, 21.01],
  krakow: [50.06, 19.94],
  "kraków": [50.06, 19.94],
  budapest: [47.5, 19.04],
  bucharest: [44.43, 26.11],
  sofia: [42.7, 23.32],
  belgrade: [44.79, 20.45],
  zagreb: [45.82, 15.98],
  athens: [37.98, 23.73],
  istanbul: [41.01, 28.98],
  ankara: [39.93, 32.86],
  kyiv: [50.45, 30.52],
  kiev: [50.45, 30.52],
  moscow: [55.75, 37.62],
  "st petersburg": [59.93, 30.34],
  "saint petersburg": [59.93, 30.34],
  tallinn: [59.44, 24.75],
  riga: [56.95, 24.11],
  vilnius: [54.69, 25.28],

  // Africa & Middle East
  cairo: [30.04, 31.24],
  lagos: [6.52, 3.38],
  accra: [5.6, -0.19],
  abuja: [9.06, 7.5],
  nairobi: [-1.29, 36.82],
  "cape town": [-33.92, 18.42],
  johannesburg: [-26.2, 28.05],
  durban: [-29.86, 31.02],
  casablanca: [33.57, -7.59],
  marrakesh: [31.63, -8.0],
  tunis: [36.81, 10.18],
  algiers: [36.75, 3.06],
  "addis ababa": [9.03, 38.74],
  dakar: [14.72, -17.47],
  "tel aviv": [32.09, 34.78],
  jerusalem: [31.78, 35.22],
  beirut: [33.89, 35.5],
  dubai: [25.2, 55.27],
  "abu dhabi": [24.45, 54.38],
  doha: [25.29, 51.53],
  riyadh: [24.71, 46.68],
  amman: [31.95, 35.93],
  tehran: [35.69, 51.39],

  // Asia
  tokyo: [35.68, 139.65],
  osaka: [34.69, 135.5],
  kyoto: [35.01, 135.77],
  seoul: [37.57, 126.98],
  busan: [35.18, 129.08],
  beijing: [39.9, 116.4],
  shanghai: [31.23, 121.47],
  shenzhen: [22.54, 114.06],
  guangzhou: [23.13, 113.26],
  "hong kong": [22.32, 114.17],
  taipei: [25.03, 121.57],
  singapore: [1.35, 103.82],
  bangkok: [13.76, 100.5],
  "kuala lumpur": [3.14, 101.69],
  jakarta: [-6.21, 106.85],
  manila: [14.6, 120.98],
  "ho chi minh city": [10.82, 106.63],
  hanoi: [21.03, 105.85],
  mumbai: [19.08, 72.88],
  delhi: [28.61, 77.21],
  "new delhi": [28.61, 77.21],
  bangalore: [12.97, 77.59],
  bengaluru: [12.97, 77.59],
  chennai: [13.08, 80.27],
  kolkata: [22.57, 88.36],
  hyderabad: [17.39, 78.49],
  karachi: [24.86, 67.0],
  lahore: [31.55, 74.34],
  dhaka: [23.81, 90.41],
  kathmandu: [27.72, 85.32],
  colombo: [6.93, 79.86],
  "almaty": [43.24, 76.89],

  // Oceania
  sydney: [-33.87, 151.21],
  melbourne: [-37.81, 144.96],
  brisbane: [-27.47, 153.03],
  perth: [-31.95, 115.86],
  adelaide: [-34.93, 138.6],
  auckland: [-36.85, 174.76],
  wellington: [-41.29, 174.78],
  christchurch: [-43.53, 172.64],
  honolulu: [21.31, -157.86],
};

/** ISO-3166-1 alpha-2 → rough population-weighted centroid. */
const COUNTRY_CODES: Record<string, LatLon> = {
  ar: [-34.0, -64.0], at: [47.6, 14.1], au: [-25.3, 133.8], be: [50.6, 4.6],
  bd: [23.7, 90.4], bg: [42.7, 25.5], br: [-14.2, -51.9], ca: [56.1, -106.3],
  ch: [46.8, 8.2], cl: [-35.7, -71.5], cn: [35.9, 104.2], co: [4.6, -74.3],
  cz: [49.8, 15.5], de: [51.2, 10.5], dk: [56.3, 9.5], do: [18.7, -70.2],
  dz: [28.0, 1.7], ee: [58.6, 25.0], eg: [26.8, 30.8], es: [40.5, -3.7],
  et: [9.1, 40.5], fi: [61.9, 25.7], fr: [46.2, 2.2], gb: [54.0, -2.0],
  gh: [7.9, -1.0], gr: [39.1, 21.8], hk: [22.32, 114.17], hr: [45.1, 15.2],
  hu: [47.2, 19.5], id: [-0.8, 113.9], ie: [53.4, -8.2], il: [31.0, 34.9],
  in: [20.6, 79.0], iq: [33.2, 43.7], ir: [32.4, 53.7], is: [64.96, -19.02],
  it: [41.9, 12.6], jm: [18.1, -77.3], jo: [30.6, 36.2], jp: [36.2, 138.3],
  ke: [-0.02, 37.9], kr: [35.9, 127.8], kz: [48.0, 66.9], lb: [33.9, 35.9],
  lk: [7.9, 80.8], lt: [55.2, 23.9], lv: [56.9, 24.6], ma: [31.8, -7.1],
  mx: [23.6, -102.6], my: [4.2, 101.98], ng: [9.1, 8.7], nl: [52.1, 5.3],
  no: [60.5, 8.5], nz: [-40.9, 174.9], pe: [-9.2, -75.0], pk: [30.4, 69.3],
  ph: [12.9, 121.8], pl: [51.9, 19.1], pt: [39.4, -8.2], qa: [25.4, 51.2],
  ro: [45.9, 25.0], rs: [44.0, 21.0], ru: [61.5, 105.3], sa: [23.9, 45.1],
  se: [60.1, 18.6], sg: [1.35, 103.82], sk: [48.7, 19.7], th: [15.9, 100.99],
  tn: [33.9, 9.5], tr: [39.0, 35.2], tw: [23.7, 120.96], ua: [48.4, 31.2],
  ae: [23.4, 53.8], us: [39.8, -98.6], uy: [-32.5, -55.8], ve: [6.4, -66.6],
  vn: [14.06, 108.3], za: [-30.6, 22.9],
};

/** Spoken country names (and the usual abbreviations) → ISO-2. */
const COUNTRY_NAMES: Record<string, string> = {
  "united states": "us", "united states of america": "us", usa: "us", us: "us",
  america: "us", "u.s.": "us", "u.s.a.": "us",
  "united kingdom": "gb", uk: "gb", "u.k.": "gb", britain: "gb",
  "great britain": "gb", england: "gb", scotland: "gb", wales: "gb",
  "northern ireland": "gb",
  canada: "ca", mexico: "mx", brazil: "br", argentina: "ar", chile: "cl",
  colombia: "co", peru: "pe", uruguay: "uy", venezuela: "ve",
  "dominican republic": "do", jamaica: "jm",
  germany: "de", deutschland: "de", france: "fr", spain: "es", "españa": "es",
  portugal: "pt", italy: "it", italia: "it", netherlands: "nl", holland: "nl",
  belgium: "be", switzerland: "ch", austria: "at", ireland: "ie",
  denmark: "dk", sweden: "se", norway: "no", finland: "fi", iceland: "is",
  poland: "pl", "czech republic": "cz", czechia: "cz", slovakia: "sk",
  hungary: "hu", romania: "ro", bulgaria: "bg", greece: "gr", croatia: "hr",
  serbia: "rs", ukraine: "ua", russia: "ru", estonia: "ee", latvia: "lv",
  lithuania: "lt", turkey: "tr", "türkiye": "tr",
  egypt: "eg", morocco: "ma", tunisia: "tn", algeria: "dz", nigeria: "ng",
  ghana: "gh", kenya: "ke", ethiopia: "et", "south africa": "za",
  israel: "il", lebanon: "lb", jordan: "jo", "saudi arabia": "sa",
  "united arab emirates": "ae", uae: "ae", qatar: "qa", iran: "ir", iraq: "iq",
  japan: "jp", "south korea": "kr", korea: "kr", china: "cn", taiwan: "tw",
  "hong kong": "hk", singapore: "sg", thailand: "th", malaysia: "my",
  indonesia: "id", philippines: "ph", vietnam: "vn", india: "in",
  pakistan: "pk", bangladesh: "bd", "sri lanka": "lk", kazakhstan: "kz",
  australia: "au", "new zealand": "nz",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort coordinates for a profile's free-text location.
 *
 * Tries the whole string as a city, then each comma-separated segment as a
 * city, then each segment as a country name, then the explicit country code.
 * Returns null when nothing matches — callers should simply omit that person
 * from the globe rather than guessing.
 */
export function resolveLocation(
  location: string | null | undefined,
  countryCode?: string | null
): LatLon | null {
  const raw = (location ?? "").trim();
  if (raw) {
    const whole = normalize(raw);
    if (CITIES[whole]) return CITIES[whole];

    const parts = whole.split(",").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (CITIES[part]) return CITIES[part];
    }
    // Country last — "Kansas City, Missouri, US" should not land on the US
    // centroid while a city segment is still unmatched.
    for (const part of [...parts].reverse()) {
      const iso = COUNTRY_NAMES[part];
      if (iso && COUNTRY_CODES[iso]) return COUNTRY_CODES[iso];
      if (part.length === 2 && COUNTRY_CODES[part]) return COUNTRY_CODES[part];
    }
  }

  const cc = (countryCode ?? "").trim().toLowerCase();
  if (cc && COUNTRY_CODES[cc]) return COUNTRY_CODES[cc];
  return null;
}

/** Keys that are aliases/abbreviations of a fuller entry — never suggest these. */
const SUGGESTION_BLOCKLIST = new Set([
  "la", "nyc", "dc", "washington dc", "u.s.a.",
]);

/**
 * "City, State/Region, Country" display strings — like a maps autofill —
 * keyed by the same lowercase key as CITIES. US/Canada entries carry a
 * state/province; everywhere else just gets a country, which is the
 * detail level normal address autofill gives once you're past city scale.
 * Only entries that actually appear in CITY_SUGGESTIONS need to be here;
 * anything missing falls back to a plain title-cased city name.
 */
const CITY_DISPLAY: Record<string, string> = {
  "los angeles": "Los Angeles, CA, USA",
  hollywood: "Hollywood, CA, USA",
  "new york": "New York, NY, USA",
  brooklyn: "Brooklyn, NY, USA",
  manhattan: "Manhattan, NY, USA",
  nashville: "Nashville, TN, USA",
  atlanta: "Atlanta, GA, USA",
  chicago: "Chicago, IL, USA",
  detroit: "Detroit, MI, USA",
  memphis: "Memphis, TN, USA",
  "new orleans": "New Orleans, LA, USA",
  austin: "Austin, TX, USA",
  houston: "Houston, TX, USA",
  dallas: "Dallas, TX, USA",
  miami: "Miami, FL, USA",
  seattle: "Seattle, WA, USA",
  portland: "Portland, OR, USA",
  "san francisco": "San Francisco, CA, USA",
  oakland: "Oakland, CA, USA",
  "san diego": "San Diego, CA, USA",
  "las vegas": "Las Vegas, NV, USA",
  denver: "Denver, CO, USA",
  phoenix: "Phoenix, AZ, USA",
  minneapolis: "Minneapolis, MN, USA",
  philadelphia: "Philadelphia, PA, USA",
  boston: "Boston, MA, USA",
  washington: "Washington, D.C., USA",
  baltimore: "Baltimore, MD, USA",
  toronto: "Toronto, ON, Canada",
  montreal: "Montreal, QC, Canada",
  vancouver: "Vancouver, BC, Canada",
  ottawa: "Ottawa, ON, Canada",
  calgary: "Calgary, AB, Canada",
  "mexico city": "Mexico City, Mexico",
  guadalajara: "Guadalajara, Mexico",
  monterrey: "Monterrey, Mexico",
  havana: "Havana, Cuba",
  kingston: "Kingston, Jamaica",
  "san juan": "San Juan, Puerto Rico",

  "sao paulo": "São Paulo, Brazil",
  "são paulo": "São Paulo, Brazil",
  "rio de janeiro": "Rio de Janeiro, Brazil",
  "buenos aires": "Buenos Aires, Argentina",
  santiago: "Santiago, Chile",
  lima: "Lima, Peru",
  bogota: "Bogotá, Colombia",
  "bogotá": "Bogotá, Colombia",
  medellin: "Medellín, Colombia",
  "medellín": "Medellín, Colombia",
  caracas: "Caracas, Venezuela",
  montevideo: "Montevideo, Uruguay",
  quito: "Quito, Ecuador",

  london: "London, UK",
  manchester: "Manchester, UK",
  liverpool: "Liverpool, UK",
  birmingham: "Birmingham, UK",
  bristol: "Bristol, UK",
  leeds: "Leeds, UK",
  sheffield: "Sheffield, UK",
  glasgow: "Glasgow, UK",
  edinburgh: "Edinburgh, UK",
  cardiff: "Cardiff, UK",
  belfast: "Belfast, UK",
  dublin: "Dublin, Ireland",
  brighton: "Brighton, UK",

  berlin: "Berlin, Germany",
  hamburg: "Hamburg, Germany",
  munich: "Munich, Germany",
  cologne: "Cologne, Germany",
  frankfurt: "Frankfurt, Germany",
  leipzig: "Leipzig, Germany",
  paris: "Paris, France",
  marseille: "Marseille, France",
  lyon: "Lyon, France",
  amsterdam: "Amsterdam, Netherlands",
  rotterdam: "Rotterdam, Netherlands",
  "the hague": "The Hague, Netherlands",
  brussels: "Brussels, Belgium",
  antwerp: "Antwerp, Belgium",
  copenhagen: "Copenhagen, Denmark",
  stockholm: "Stockholm, Sweden",
  gothenburg: "Gothenburg, Sweden",
  oslo: "Oslo, Norway",
  bergen: "Bergen, Norway",
  helsinki: "Helsinki, Finland",
  reykjavik: "Reykjavík, Iceland",
  "reykjavík": "Reykjavík, Iceland",
  madrid: "Madrid, Spain",
  barcelona: "Barcelona, Spain",
  valencia: "Valencia, Spain",
  seville: "Seville, Spain",
  lisbon: "Lisbon, Portugal",
  porto: "Porto, Portugal",
  rome: "Rome, Italy",
  milan: "Milan, Italy",
  naples: "Naples, Italy",
  turin: "Turin, Italy",
  zurich: "Zurich, Switzerland",
  geneva: "Geneva, Switzerland",
  vienna: "Vienna, Austria",
  prague: "Prague, Czechia",
  warsaw: "Warsaw, Poland",
  krakow: "Kraków, Poland",
  "kraków": "Kraków, Poland",
  budapest: "Budapest, Hungary",
  bucharest: "Bucharest, Romania",
  sofia: "Sofia, Bulgaria",
  belgrade: "Belgrade, Serbia",
  zagreb: "Zagreb, Croatia",
  athens: "Athens, Greece",
  istanbul: "Istanbul, Türkiye",
  ankara: "Ankara, Türkiye",
  kyiv: "Kyiv, Ukraine",
  kiev: "Kyiv, Ukraine",
  moscow: "Moscow, Russia",
  "st petersburg": "St Petersburg, Russia",
  "saint petersburg": "St Petersburg, Russia",
  tallinn: "Tallinn, Estonia",
  riga: "Riga, Latvia",
  vilnius: "Vilnius, Lithuania",

  cairo: "Cairo, Egypt",
  lagos: "Lagos, Nigeria",
  accra: "Accra, Ghana",
  abuja: "Abuja, Nigeria",
  nairobi: "Nairobi, Kenya",
  "cape town": "Cape Town, South Africa",
  johannesburg: "Johannesburg, South Africa",
  durban: "Durban, South Africa",
  casablanca: "Casablanca, Morocco",
  marrakesh: "Marrakesh, Morocco",
  tunis: "Tunis, Tunisia",
  algiers: "Algiers, Algeria",
  "addis ababa": "Addis Ababa, Ethiopia",
  dakar: "Dakar, Senegal",
  "tel aviv": "Tel Aviv, Israel",
  jerusalem: "Jerusalem, Israel",
  beirut: "Beirut, Lebanon",
  dubai: "Dubai, UAE",
  "abu dhabi": "Abu Dhabi, UAE",
  doha: "Doha, Qatar",
  riyadh: "Riyadh, Saudi Arabia",
  amman: "Amman, Jordan",
  tehran: "Tehran, Iran",

  tokyo: "Tokyo, Japan",
  osaka: "Osaka, Japan",
  kyoto: "Kyoto, Japan",
  seoul: "Seoul, South Korea",
  busan: "Busan, South Korea",
  beijing: "Beijing, China",
  shanghai: "Shanghai, China",
  shenzhen: "Shenzhen, China",
  guangzhou: "Guangzhou, China",
  "hong kong": "Hong Kong",
  taipei: "Taipei, Taiwan",
  singapore: "Singapore",
  bangkok: "Bangkok, Thailand",
  "kuala lumpur": "Kuala Lumpur, Malaysia",
  jakarta: "Jakarta, Indonesia",
  manila: "Manila, Philippines",
  "ho chi minh city": "Ho Chi Minh City, Vietnam",
  hanoi: "Hanoi, Vietnam",
  mumbai: "Mumbai, India",
  delhi: "Delhi, India",
  "new delhi": "New Delhi, India",
  bangalore: "Bangalore, India",
  bengaluru: "Bengaluru, India",
  chennai: "Chennai, India",
  kolkata: "Kolkata, India",
  hyderabad: "Hyderabad, India",
  karachi: "Karachi, Pakistan",
  lahore: "Lahore, Pakistan",
  dhaka: "Dhaka, Bangladesh",
  kathmandu: "Kathmandu, Nepal",
  colombo: "Colombo, Sri Lanka",
  almaty: "Almaty, Kazakhstan",

  sydney: "Sydney, NSW, Australia",
  melbourne: "Melbourne, VIC, Australia",
  brisbane: "Brisbane, QLD, Australia",
  perth: "Perth, WA, Australia",
  adelaide: "Adelaide, SA, Australia",
  auckland: "Auckland, New Zealand",
  wellington: "Wellington, New Zealand",
  christchurch: "Christchurch, New Zealand",
  honolulu: "Honolulu, HI, USA",
};

/**
 * City names for a type-ahead — deduplicated by coordinate (so aliases like
 * "la"/"los angeles" only surface once) — shown as "City, State, Country"
 * like a maps autofill. Typing "den" suggests "Denver, CO, USA"; picking a
 * suggestion writes plain text into the profile's `location` field, which
 * `resolveLocation` above already knows how to read back regardless of the
 * trailing state/country (it matches on the city segment first).
 */
export const CITY_SUGGESTIONS: string[] = (() => {
  const seenCoords = new Set<string>();
  const out: string[] = [];
  for (const [key, coords] of Object.entries(CITIES)) {
    if (SUGGESTION_BLOCKLIST.has(key) || key.length <= 3) continue;
    const coordKey = coords.join(",");
    if (seenCoords.has(coordKey)) continue;
    seenCoords.add(coordKey);
    out.push(CITY_DISPLAY[key] ?? key.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return out.sort((a, b) => a.localeCompare(b));
})();

/**
 * Small deterministic offset so several people in the same city don't stack
 * into one unreadable pin. Seeded by id, so a person never jumps around
 * between renders.
 */
export function scatter([lat, lon]: LatLon, seed: string, spread = 2.2): LatLon {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 3600) / 3600 * Math.PI * 2;
  const r = (((h >>> 12) & 0xff) / 255) * spread;
  const dLat = Math.sin(a) * r;
  const dLon = (Math.cos(a) * r) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return [
    Math.max(-85, Math.min(85, lat + dLat)),
    ((lon + dLon + 540) % 360) - 180,
  ];
}
