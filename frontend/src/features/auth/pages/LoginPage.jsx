import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { Field } from "../../../components/common/Field";
import { ErrorAlert } from "../../../components/feedback/ErrorAlert";
import { useAuth } from "../../../contexts/AuthContext";
import { extractApiErrorMessage } from "../../../lib/apiError";

const INITIAL_FORM = {
  username: "",
  password: "",
};

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      setError(extractApiErrorMessage(requestError, "No fue posible iniciar sesión."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Card
        title="Ingreso al ERP"
        subtitle="Autenticación JWT para inventario, compras, ventas POS y reportes."
      >
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
      </Card>
    </div>
  );
}
