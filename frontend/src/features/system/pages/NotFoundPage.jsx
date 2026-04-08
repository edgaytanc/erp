import { Link } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";

export function NotFoundPage() {
  return (
    <div className="status-page">
      <Card title="404" subtitle="La ruta que buscas no existe.">
        <Link to="/app">
          <Button>Ir al inicio</Button>
        </Link>
      </Card>
    </div>
  );
}
