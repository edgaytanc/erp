import { Link } from "react-router-dom";

import { Card } from "../../../components/common/Card";
import { Button } from "../../../components/common/Button";

export function PosEntryCard() {
  return (
    <Card
      title="Ventas POS"
      subtitle="Base operativa lista para arrancar EPIC E10."
    >
      <p>
        La estructura del POS ya quedó preparada dentro de{" "}
        <code>features/pos</code>, con APIs, componentes, hooks y estado listos
        para crecer sin volver el proyecto un spaghetti de caja registradora.
      </p>

      <div className="inline-actions">
        <Link to="/pos">
          <Button>Ir al POS</Button>
        </Link>
      </div>
    </Card>
  );
}
