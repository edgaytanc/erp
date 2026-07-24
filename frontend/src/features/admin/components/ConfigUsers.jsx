import { Button } from "../../../components/common/Button";

export function ConfigUsers({
  userForm,
  updateUserField,
  handleSaveUser,
  isSaving,
  editingUserId,
  setEditingUserId,
  setUserForm,
  emptyUserForm,
  users,
  branches,
  editUser,
  toggleUser,
  ROLE_LABELS,
}) {
  return (
    <div className="admin-users-container">
      <section
        className="admin-panel admin-panel--users"
        style={{ marginBottom: "1rem" }}
      >
        <div className="admin-panel__header">
          <h3>{editingUserId ? "Editar Usuario" : "Nuevo Usuario"}</h3>
          <span>Formulario</span>
        </div>
        <form className="admin-form" onSubmit={handleSaveUser}>
          <div className="admin-form-row admin-form-row--three">
            <label>
              <span>Usuario</span>
              <input
                disabled={Boolean(editingUserId)}
                onChange={(event) =>
                  updateUserField("username", event.target.value)
                }
                required
                type="text"
                value={userForm.username}
              />
            </label>
            <label>
              <span>Email</span>
              <input
                onChange={(event) =>
                  updateUserField("email", event.target.value)
                }
                type="email"
                value={userForm.email}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                onChange={(event) =>
                  updateUserField("password", event.target.value)
                }
                placeholder={editingUserId ? "Opcional" : ""}
                required={!editingUserId}
                type="password"
                value={userForm.password}
              />
            </label>
          </div>
          <div className="admin-form-row admin-form-row--four">
            <label>
              <span>Nombres</span>
              <input
                onChange={(event) =>
                  updateUserField("first_name", event.target.value)
                }
                type="text"
                value={userForm.first_name}
              />
            </label>
            <label>
              <span>Apellidos</span>
              <input
                onChange={(event) =>
                  updateUserField("last_name", event.target.value)
                }
                type="text"
                value={userForm.last_name}
              />
            </label>
            <label>
              <span>Rol</span>
              <select
                onChange={(event) =>
                  updateUserField("role", event.target.value)
                }
                value={userForm.role}
              >
                <option value="admin">Administrador</option>
                <option value="sales">Vendedor</option>
                <option value="purchases">Encargado de compras</option>
              </select>
            </label>
            <label>
              <span>Sucursal</span>
              <select
                onChange={(event) =>
                  updateUserField("branch", event.target.value)
                }
                value={userForm.branch}
              >
                <option value="">Sin sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="admin-check">
            <input
              checked={userForm.is_active}
              onChange={(event) =>
                updateUserField("is_active", event.target.checked)
              }
              type="checkbox"
            />
            <span>Usuario activo</span>
          </label>
          <div className="admin-actions-row">
            <Button disabled={isSaving} type="submit">
              {editingUserId ? "Actualizar" : "Crear"} usuario
            </Button>
            <Button
              onClick={() => {
                setEditingUserId("");
                setUserForm(emptyUserForm);
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
          <h3>Listado de Usuarios</h3>
          <span>{users.length}</span>
        </div>
        <div className="admin-user-list-wrapper" style={{ overflowX: "auto" }}>
          <div className="admin-user-list">
            {users.map((user) => (
              <article className="admin-user-row" key={user.id}>
                <div>
                  <strong>{user.username}</strong>
                  <span>
                    {[user.first_name, user.last_name]
                      .filter(Boolean)
                      .join(" ") ||
                      user.email ||
                      "Sin nombre"}
                  </span>
                </div>
                <span>{ROLE_LABELS[user.role] || user.role}</span>
                <span>{user.branch_name || "Sin sucursal"}</span>
                <span
                  className={`admin-badge ${user.is_active ? "admin-badge--on" : ""}`}
                >
                  {user.is_active ? "Activo" : "Inactivo"}
                </span>
                <button onClick={() => editUser(user)} type="button">
                  Editar
                </button>
                <button onClick={() => toggleUser(user)} type="button">
                  {user.is_active ? "Desactivar" : "Activar"}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
