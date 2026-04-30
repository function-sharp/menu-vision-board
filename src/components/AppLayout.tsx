import { useEffect, useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useStores, useAllItems } from "@/hooks/useDashboardData";
import { Upload, Search } from "lucide-react";
import { Button } from "./ui/button";
import { GlobalSearch } from "./GlobalSearch";

export default function AppLayout() {
  const { data: stores } = useStores();
  const { data: items } = useAllItems();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 sticky top-0 z-10 gap-3">
            <div className="flex items-center gap-3 min-w-0">
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
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex-1 max-w-md hidden sm:flex items-center gap-2 h-9 px-3 rounded-md border bg-background text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search stores, items, categories...</span>
              <kbd className="hidden md:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="sm:hidden"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Refresh data
                </Link>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 max-w-full overflow-x-hidden">
            <Outlet />
          </main>
        </div>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </SidebarProvider>
  );
}
