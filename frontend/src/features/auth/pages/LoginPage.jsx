import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { Field } from "../../../components/common/Field";
import { ErrorAlert } from "../../../components/feedback/ErrorAlert";
import { useAuth } from "../../../contexts/AuthContext";
import api from "../../../lib/axios";
import { extractApiErrorMessage } from "../../../lib/apiError";

const INITIAL_FORM = {
  username: "",
  password: "",
};

const DEFAULT_BRANDING = {
  name: "ERP",
  logo: "",
};

function resolveLogoUrl(logo) {
  if (!logo) {
    return "";
  }

  if (/^https?:\/\//i.test(logo)) {
    return logo;
  }

  if (logo.startsWith("/")) {
    return `${new URL(api.defaults.baseURL).origin}${logo}`;
  }

  return logo;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [hasLogoError, setHasLogoError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const logoUrl = resolveLogoUrl(branding.logo);

  useEffect(() => {
    let isMounted = true;

    async function fetchBranding() {
      try {
        const response = await api.get("/config/public-branding/");

        if (isMounted) {
          setBranding({
            name: response.data?.name || DEFAULT_BRANDING.name,
            logo: response.data?.logo || "",
          });
          setHasLogoError(false);
        }
      } catch (brandingError) {
        if (isMounted) {
          setBranding(DEFAULT_BRANDING);
        }
      }
    }

    fetchBranding();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const user = await login(form);
      const targetPath = user.role === "sales" ? "/pos" : "/app";
      navigate(targetPath, { replace: true });
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No fue posible iniciar sesión."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-card card" aria-labelledby="login-title">
        <header className="auth-card__brand">
          {logoUrl && !hasLogoError ? (
            <img
              className="auth-card__logo"
              src={logoUrl}
              alt={`Logo de ${branding.name}`}
              onError={() => setHasLogoError(true)}
            />
          ) : (
            <div
              className="auth-card__logo auth-card__logo--fallback"
              aria-hidden="true"
            >
              {branding.name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="auth-card__company">{branding.name}</p>
        </header>

        <div className="auth-card__intro">
          {/* <h1 id="login-title">Ingreso al ERP</h1> */}
          <p>Inventario, Compras, Ventas POS y Reportes.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <ErrorAlert message={error} />

          <Field
            id="username"
            name="username"
            label="Usuario"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
            placeholder="Ingresa tu usuario"
            required
          />

          <Field
            id="password"
            name="password"
            type="password"
            label="Contraseña"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            placeholder="Ingresa tu contraseña"
            required
          />

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </div>
  );
}
