import React, { createContext, useMemo, useState, useEffect } from "react";

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
});

const initialUser = () => {
  const saved = localStorage.getItem("rms_user");
  const token = localStorage.getItem("rms_token");
  if (token && saved) {
    try {
      return { token, user: JSON.parse(saved) };
    } catch (err) {
      return { token: null, user: null };
    }
  }
  return { token: null, user: null };
};

export const AuthProvider = ({ children }) => {
  const [{ token, user }, setAuth] = useState(initialUser);

  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    const savedUser = localStorage.getItem("rms_user");
    const savedToken = localStorage.getItem("rms_token");
    if (savedUser && savedToken) {
      setAuth({ token: savedToken, user: JSON.parse(savedUser) });
    }
  }, []);

  const login = (tokenValue, userValue) => {
    localStorage.setItem("rms_token", tokenValue);
    localStorage.setItem("rms_user", JSON.stringify(userValue));
    setAuth({ token: tokenValue, user: userValue });
  };

  const logout = () => {
    localStorage.removeItem("rms_token");
    localStorage.removeItem("rms_user");
    setAuth({ token: null, user: null });
  };

  const value = useMemo(
    () => ({ isAuthenticated, user, token, login, logout }),
    [isAuthenticated, user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
