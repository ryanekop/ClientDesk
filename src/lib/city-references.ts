export type CityReferenceItem = {
  city_code: string;
  city_name: string;
  province_code: string;
  province_name: string;
};

export function normalizeCityCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D+/g, "");
  return digits.length === 4 ? digits : "";
}

export function buildCityDisplayName(city: Pick<CityReferenceItem, "city_name" | "province_name">): string {
  const cityName = String(city.city_name || "").trim();
  const provinceName = String(city.province_name || "").trim();
  if (!provinceName) return cityName;
  return `${cityName}, ${provinceName}`;
}

export function isCityReferenceItem(value: unknown): value is CityReferenceItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.city_code === "string" &&
    typeof record.city_name === "string" &&
    typeof record.province_code === "string" &&
    typeof record.province_name === "string"
  );
}
