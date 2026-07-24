import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../lib/axios";
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setAuthStorage,
} from "../lib/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => getAccessToken());
  const [refreshToken, setRefreshToken] = useState(() => getRefreshToken());
  const [user, setUser] = useState(() => getStoredUser());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const logout = useCallback(() => {
    clearAuthStorage();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const fetchMe = useCallback(async () => {
    const response = await api.get("/auth/me/");
    setUser(response.data);
    setAuthStorage({
      accessToken: getAccessToken(),
      refreshToken: getRefreshToken(),
      user: response.data,
    });
    return response.data;
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const loginResponse = await api.post("/auth/login/", {
      username,
      password,
    });
    const nextAccessToken = loginResponse.data.access;
    const nextRefreshToken = loginResponse.data.refresh;

    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    setAuthStorage({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      user: null,
    });

    const meResponse = await api.get("/auth/me/", {
      headers: {
        Authorization: `Bearer ${nextAccessToken}`,
      },
    });

    setUser(meResponse.data);
    setAuthStorage({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      user: meResponse.data,
    });

    return meResponse.data;
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const currentRefreshToken = getRefreshToken();

    if (!currentRefreshToken) {
      logout();
      return null;
    }

    try {
      const response = await api.post("/auth/refresh/", {
        refresh: currentRefreshToken,
      });
      const nextAccessToken = response.data.access;

      setAccessToken(nextAccessToken);
      setRefreshToken(currentRefreshToken);
      setAuthStorage({
        accessToken: nextAccessToken,
        refreshToken: currentRefreshToken,
        user: getStoredUser(),
      });

      return nextAccessToken;
    } catch (error) {
      logout();
      throw error;
    }
  }, [logout]);

  useEffect(() => {
    async function bootstrap() {
      if (!accessToken) {
        setIsBootstrapping(false);
        return;
      }

      try {
        await fetchMe();
      } catch (error) {
        try {
          await refreshAccessToken();
          await fetchMe();
        } catch (refreshError) {
          logout();
        }
      } finally {
        setIsBootstrapping(false);
      }
    }

    bootstrap();
  }, [accessToken, fetchMe, logout, refreshAccessToken]);

  const value = useMemo(
    () => ({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: Boolean(accessToken && user),
      isBootstrapping,
      login,
      logout,
      refreshAccessToken,
      fetchMe,
    }),
    [
      accessToken,
      refreshToken,
      user,
      isBootstrapping,
      login,
      logout,
      refreshAccessToken,
      fetchMe,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
