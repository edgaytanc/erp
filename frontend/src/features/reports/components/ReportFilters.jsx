import { Button } from "../../../components/common/Button";

export function ReportFilters({
  activeReport,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  branchId,
  setBranchId,
  branches,
  cashierId,
  setCashierId,
  users,
  limit,
  setLimit,
  isLoading,
  reportData,
  onSubmit,
  onGeneratePdf,
}) {
  return (
    <form className="reports-filters" onSubmit={onSubmit}>
      <label>
        <span>Desde</span>
        <input
          disabled={!activeReport.usesDates}
          onChange={(event) => setDateFrom(event.target.value)}
          type="date"
          value={dateFrom}
        />
      </label>
      <label>
        <span>Hasta</span>
        <input
          disabled={!activeReport.usesDates}
          onChange={(event) => setDateTo(event.target.value)}
          type="date"
          value={dateTo}
        />
      </label>
      <label>
        <span>Sucursal</span>
        <select
          onChange={(event) => setBranchId(event.target.value)}
          value={branchId}
        >
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
      {activeReport.usesCashiers ? (
        <label>
          <span>Cajero</span>
          <select
            onChange={(event) => setCashierId(event.target.value)}
            value={cashierId}
          >
            <option value="">Todos los cajeros</option>
            {users
              .filter((user) => user.role === "sales" || user.role === "admin")
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name || user.last_name
                    ? `${user.first_name} ${user.last_name}`.trim()
                    : user.username}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      {activeReport.usesLimit ? (
        <label>
          <span>Top N</span>
          <input
            onChange={(event) => setLimit(Number(event.target.value))}
            type="number"
            min="1"
            max="500"
            value={limit}
          />
        </label>
      ) : null}
      <Button disabled={isLoading} type="submit">
        Aplicar
      </Button>
      <Button
        disabled={isLoading || !reportData}
        onClick={onGeneratePdf}
        type="button"
        variant="secondary"
      >
        Generar versión PDF
      </Button>
    </form>
  );
}
