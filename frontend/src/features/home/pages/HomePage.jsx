import { Card } from "../../../components/common/Card";
import { useAuth } from "../../../contexts/AuthContext";

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="page-grid">
      <Card title="Bienvenido" subtitle="Base inicial del frontend para el ERP modular.">
        <p>
          Usuario autenticado: <strong>{user?.username}</strong>
        </p>
        <p>
          Rol activo: <strong>{user?.role}</strong>
        </p>
      </Card>

      <Card title="Estado de EPIC E9" subtitle="Proyecto React, rutas, auth JWT y consumo API.">
        <ul className="feature-list">
          <li>Proyecto Vite + React operativo.</li>
          <li>Autenticación JWT conectada al backend.</li>
          <li>Rutas protegidas por sesión y por rol.</li>
          <li>Layouts base listos para E10.</li>
        </ul>
      </Card>
    </div>
  );
}
