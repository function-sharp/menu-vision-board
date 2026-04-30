import { Outlet, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useStores, useAllItems } from "@/hooks/useDashboardData";
import { Upload } from "lucide-react";
import { Button } from "./ui/button";

export default function AppLayout() {
  const { data: stores } = useStores();
  const { data: items } = useAllItems();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden md:flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{stores?.length ?? "—"}</span> stores
                </span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{items?.length ?? "—"}</span> menu items
                </span>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/upload">
                <Upload className="h-4 w-4 mr-2" />
                Refresh data
              </Link>
            </Button>
          </header>
          <main className="flex-1 p-4 md:p-6 max-w-full overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
