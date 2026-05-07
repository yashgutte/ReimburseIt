import axios from "axios";

if (import.meta.env.PROD && !import.meta.env.VITE_BACKEND_URL) {
  throw new Error("Missing VITE_BACKEND_URL in production build.");
}

const axiosInstance = axios.create({
  // VITE_BACKEND_URL is set in .env (local) and in Vercel env variables (production)
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:8080",
  timeout: 30000, // 30 seconds (Cloudinary uploads can be slow on free tier)
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

// ── Request interceptor ──────────────────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("rms_token") || localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // For multipart/form-data, let the browser set the boundary automatically
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ─────────────────────────────────────────────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // No response at all → network / CORS issue
    if (!error.response) {
      return Promise.reject({
        message: "Network error. Please check your connection and try again.",
        isNetworkError: true,
      });
    }

    // 401 Unauthorized → clear stale tokens
    if (error.response.status === 401) {
      localStorage.removeItem("rms_token");
      localStorage.removeItem("rms_user");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("rms:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

