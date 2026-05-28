export function BranchPanel({ branchId, branchName }) {
  return (
    <section className="pos-panel pos-branch-panel">
      <div className="pos-branch-summary">
        <span>Sucursal asignada</span>
        {branchId ? (
          <>
            <strong>{branchName || "Sucursal activa"}</strong>
            <small>{branchId}</small>
          </>
        ) : (
          <strong>Sin sucursal asignada</strong>
        )}
      </div>
    </section>
  );
}
