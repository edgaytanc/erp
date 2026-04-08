import { Card } from "../../../components/common/Card";

export function PosPage() {
  return (
    <div className="page-grid page-grid--single">
      <Card title="POS - Punto de Venta" subtitle="Pantalla base preparada para la implementación del flujo completo.">
        <p>
          Esta vista ya está conectada al sistema de autenticación y protegida por rol
          <strong> admin/sales</strong>.
        </p>
        <p>
          En el siguiente paso implementaremos la búsqueda rápida, carrito, totales, confirmación,
          anulación y ticket.
        </p>
      </Card>
    </div>
  );
}
