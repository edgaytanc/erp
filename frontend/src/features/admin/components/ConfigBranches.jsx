import { Button } from "../../../components/common/Button";

export function ConfigBranches({
  branchForm,
  updateBranchField,
  handleSaveBranch,
  isSaving,
  editingBranchId,
  setEditingBranchId,
  setBranchForm,
  emptyBranchForm,
  filteredBranches,
  editBranch,
  toggleBranch,
}) {
  return (
    <div className="admin-config-grid">
      <section className="admin-panel">
        <div className="admin-panel__header">
          <h3>{editingBranchId ? "Editar Sucursal" : "Nueva Sucursal"}</h3>
          <span>Formulario</span>
        </div>
        <form className="admin-form" onSubmit={handleSaveBranch}>
          <label>
            <span>Nombre</span>
            <input
              onChange={(event) =>
                updateBranchField("name", event.target.value)
              }
              required
              type="text"
              value={branchForm.name}
            />
          </label>
          <label>
            <span>Dirección</span>
            <textarea
              onChange={(event) =>
                updateBranchField("address", event.target.value)
              }
              rows="2"
              value={branchForm.address}
            />
          </label>
          <label className="admin-check">
            <input
              checked={branchForm.is_active}
              onChange={(event) =>
                updateBranchField("is_active", event.target.checked)
              }
              type="checkbox"
            />
            <span>Sucursal activa</span>
          </label>
          <div className="admin-actions-row">
            <Button disabled={isSaving} type="submit">
              {editingBranchId ? "Actualizar" : "Crear"} sucursal
            </Button>
            <Button
              onClick={() => {
                setEditingBranchId("");
                setBranchForm(emptyBranchForm);
              }}
              type="button"
              variant="secondary"
            >
              Limpiar
            </Button>
          </div>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel__header">
          <h3>Listado de Sucursales</h3>
          <span>{filteredBranches.length}</span>
        </div>
        <div className="admin-list">
          {filteredBranches.length === 0 ? (
            <p className="admin-empty-state">
              No hay sucursales registradas para esta empresa.
            </p>
          ) : (
            filteredBranches.map((branch) => (
              <article className="admin-list-row" key={branch.id}>
                <div>
                  <strong>{branch.name}</strong>
                  <span>{branch.address || "Sin dirección"}</span>
                </div>
                <span
                  className={`admin-badge ${branch.is_active ? "admin-badge--on" : ""}`}
                >
                  {branch.is_active ? "Activa" : "Inactiva"}
                </span>
                <button onClick={() => editBranch(branch)} type="button">
                  Editar
                </button>
                <button onClick={() => toggleBranch(branch)} type="button">
                  {branch.is_active ? "Baja" : "Alta"}
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
