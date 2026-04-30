import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Overview from "./pages/Overview";
import Stores from "./pages/Stores";
import StoreDetail from "./pages/StoreDetail";
import MenuBrowser from "./pages/MenuBrowser";
import ItemComparison from "./pages/ItemComparison";
import Analytics from "./pages/Analytics";
import Upload from "./pages/Upload";
import Promotions from "./pages/Promotions";
import UberEats from "./pages/UberEats";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/stores" element={<Stores />} />
            <Route path="/stores/:slug" element={<StoreDetail />} />
            <Route path="/menu" element={<MenuBrowser />} />
            <Route path="/compare" element={<ItemComparison />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/uber-eats" element={<UberEats />} />
            <Route path="/upload" element={<Upload />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
