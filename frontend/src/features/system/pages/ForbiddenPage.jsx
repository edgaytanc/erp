import { Link } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";

export function ForbiddenPage() {
  return (
    <div className="status-page">
      <Card title="Acceso denegado" subtitle="Tu rol no tiene permisos para entrar a esta ruta.">
        <Link to="/app">
          <Button>Volver al inicio</Button>
        </Link>
      </Card>
    </div>
  );
}
