import { Button } from "../../../components/common/Button";

export function SaleActions({ canCancel, canConfirm, onCancel, onClear, onConfirm }) {
  return (
    <section className="pos-actions">
      <Button disabled={!canConfirm} onClick={onConfirm}>
        Confirmar venta
      </Button>
      <Button onClick={onClear} variant="secondary">
        Nueva venta
      </Button>
      <Button disabled={!canCancel} onClick={onCancel} variant="secondary">
        Anular
      </Button>
      <Button onClick={() => window.print()} variant="secondary">
        Imprimir
      </Button>
    </section>
  );
}
