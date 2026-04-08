import { Outlet } from "react-router-dom";

import { AppHeader } from "../components/layout/AppHeader";
import { AppSidebar } from "../components/layout/AppSidebar";
import { PosEntryCard } from "../features/pos/components/PosEntryCard";

export function AppLayout() {
  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-shell__content">
        <AppHeader />
        <main className="app-main">
          <PosEntryCard />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
