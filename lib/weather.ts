export interface WeatherData {
  tempC: number;
  humidity: number;        // %
  uvIndex: number;
  windKph: number;
  precipMmH: number;       // mm/hr
  conditionCode: number;
  condition: string;
  conditionIcon: string;
  source: "live" | "fallback";
  fetchedAt: string;
}

export interface DiseaseRisk {
  name: string;
  risk: "High" | "Medium" | "Low";
  reason: string;
}

// Tomorrow.io weather code → human label + emoji
const CODES: Record<number, [string, string]> = {
  1000: ["Clear",          "☀️"],
  1100: ["Mostly Clear",   "🌤️"],
  1101: ["Partly Cloudy",  "⛅"],
  1102: ["Mostly Cloudy",  "🌥️"],
  1001: ["Cloudy",         "☁️"],
  2000: ["Fog",            "🌫️"],
  2100: ["Light Fog",      "🌫️"],
  4000: ["Drizzle",        "🌦️"],
  4001: ["Rain",           "🌧️"],
  4200: ["Light Rain",     "🌦️"],
  4201: ["Heavy Rain",     "⛈️"],
  8000: ["Thunderstorm",   "⛈️"],
};

// Addis Ababa coords
const LAT = 9.032;
const LON = 38.747;

// Simulated May/long-rains-onset baseline for graceful fallback
const FALLBACK: WeatherData = {
  tempC: 22, humidity: 78, uvIndex: 6, windKph: 11, precipMmH: 0.1,
  conditionCode: 1101, condition: "Partly Cloudy", conditionIcon: "⛅",
  source: "fallback", fetchedAt: new Date().toISOString(),
};

export async function getWeather(): Promise<WeatherData> {
  const key = process.env.TOMORROW_IO_API_KEY;
  if (!key) return FALLBACK;

  try {
    const url = `https://api.tomorrow.io/v4/weather/realtime?location=${LAT},${LON}&units=metric&apikey=${key}`;
    const res = await fetch(url, {
      next: { revalidate: 900 }, // cache 15 min
    });
    if (!res.ok) throw new Error(`Tomorrow.io ${res.status}`);
    const json = await res.json();
    const v = json.data.values as Record<string, number>;

    const code = v.weatherCode ?? 1101;
    const [condition, conditionIcon] = CODES[code] ?? ["Partly Cloudy", "⛅"];

    return {
      tempC:        Math.round(v.temperature ?? 22),
      humidity:     Math.round(v.humidity ?? 78),
      uvIndex:      Math.round(v.uvIndex ?? 6),
      windKph:      Math.round((v.windSpeed ?? 3) * 3.6), // m/s → km/h
      precipMmH:    v.precipitationIntensity ?? 0,
      conditionCode: code,
      condition,
      conditionIcon,
      source: "live",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return FALLBACK;
  }
}

// Disease risk engine — driven by real weather values
export function calcDiseaseRisks(w: WeatherData): DiseaseRisk[] {
  const { tempC, humidity, precipMmH } = w;

  const botrytis: DiseaseRisk = {
    name: "Gray Mold (Botrytis)",
    risk: humidity > 80 && tempC < 25 ? "High"
        : humidity > 70              ? "Medium"
        :                              "Low",
    reason: `Humidity ${humidity}% · ${tempC}°C — ${
      humidity > 80 ? "spore germination optimal, act now" :
      humidity > 70 ? "conditions favour spread" :
      "below threshold"
    }`,
  };

  const mildew: DiseaseRisk = {
    name: "Powdery Mildew",
    risk: humidity < 55 && tempC > 22 ? "High"
        : humidity < 70 && tempC > 18  ? "Medium"
        :                                "Low",
    reason: `${humidity}% humidity · ${tempC}°C — ${
      humidity < 55 ? "low humidity + warm: high risk window" :
      humidity < 70 ? "moderate risk — monitor closely" :
      "high humidity suppresses mildew"
    }`,
  };

  const rootRot: DiseaseRisk = {
    name: "Root Rot (Phytophthora)",
    risk: precipMmH > 2  && humidity > 85 ? "High"
        : precipMmH > 0.5 || humidity > 78  ? "Medium"
        :                                     "Low",
    reason: `${precipMmH.toFixed(1)} mm/hr precipitation · ${humidity}% humidity — ${
      precipMmH > 2  ? "waterlogging risk: reduce irrigation now" :
      precipMmH > 0.5 ? "elevated soil moisture: monitor drainage" :
      "soil moisture within safe range"
    }`,
  };

  return [botrytis, mildew, rootRot];
}
