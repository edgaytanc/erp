import { useState } from "react";
import { Outlet } from "react-router-dom";

import { AppHeader } from "../components/layout/AppHeader";
import { AppSidebar } from "../components/layout/AppSidebar";
import { PosEntryCard } from "../features/pos/components/PosEntryCard";

export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className={`app-shell ${isCollapsed ? "app-shell--collapsed" : ""}`}>
      <AppSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <div className="app-shell__content">
        <AppHeader
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />
        <main className="app-main">
          {/* <PosEntryCard /> */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
