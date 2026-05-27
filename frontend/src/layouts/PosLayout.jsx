import { Link, Outlet } from "react-router-dom";

import { Button } from "../components/common/Button";

export function PosLayout() {
  return (
    <div className="pos-layout">
      <header className="pos-layout__header">
        <div>
          <h1>POS</h1>
          <p>Interfaz rápida para vendedores y administradores.</p>
        </div>
        <Link to="/app">
          <Button variant="secondary">Volver al panel</Button>
        </Link>
      </header>
      <main className="pos-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
