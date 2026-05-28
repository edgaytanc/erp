import { PosShell } from "../components/PosShell";
import { usePos } from "../hooks/usePos";
import "../../../styles/pos.css";

export function PosPage() {
  const pos = usePos();

  return (
    <PosShell
      actions={pos.actions}
      isProductSearchLoading={pos.isProductSearchLoading}
      searchInputRef={pos.searchInputRef}
      state={pos.state}
    />
  );
}
