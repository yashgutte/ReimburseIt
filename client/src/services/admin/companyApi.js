import axiosInstance from "../../Authorisation/axiosConfig";

export async function fetchCompanies() {
  const { data } = await axiosInstance.get("/api/admin/companies");
  const inner = data?.data ?? data;
  if (Array.isArray(inner?.companies)) return inner.companies;
  if (Array.isArray(inner)) return inner;
  return [];
}

export async function createCompany({ name, country, baseCurrency }) {
  const { data } = await axiosInstance.post("/api/admin/companies", {
    name,
    country,
    baseCurrency,
  });
  return data;
}
