export async function fetchCountries() {
  const res = await fetch(
    "https://restcountries.com/v3.1/all?fields=name,cca2,currencies"
  );
  if (!res.ok) {
    throw new Error("Could not load countries");
  }
  const data = await res.json();
  return data
    .map((c) => {
      const currencyCodes = c.currencies ? Object.keys(c.currencies) : [];
      const primary = currencyCodes[0];
      return {
        name: c.name.common,
        code: c.cca2,
        currencyCode: primary || "",
        currencyName: primary ? c.currencies[primary]?.name || primary : "",
      };
    })
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}
