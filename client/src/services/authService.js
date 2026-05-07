import axiosInstance from "../Authorisation/axiosConfig";

function getErrorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message && typeof error.message === "string") return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * Login against the real API so seeded users and DB-backed accounts work.
 */
export const login = async ({ email, password }) => {
  try {
    const { data } = await axiosInstance.post("/api/auth/login", {
      email,
      password,
    });
    if (!data?.success || !data.token || !data.user) {
      const err = new Error(data?.message || "Login failed");
      throw err;
    }
    return { token: data.token, user: data.user };
  } catch (error) {
    const err = new Error(getErrorMessage(error));
    throw err;
  }
};

export async function forgotPassword(email) {
  try {
    const { data } = await axiosInstance.post("/api/auth/forgot-password", {
      email: email.trim().toLowerCase(),
    });
    if (!data?.success) {
      throw new Error(data?.message || "Request failed");
    }
    return data.message || "";
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Register against the real API — creates a company + admin account.
 */
export const register = async ({ name, email, password, country }) => {
  try {
    const { data } = await axiosInstance.post("/api/auth/signup", {
      companyName: `${name}'s Company`,
      country,
      name,
      email,
      password,
      username: email.split("@")[0],
    });
    if (!data?.success) {
      const err = new Error(data?.message || "Registration failed");
      throw err;
    }
    return { success: true, user: data.user, token: data.token };
  } catch (error) {
    const err = new Error(getErrorMessage(error));
    throw err;
  }
};

