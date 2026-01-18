import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BetSlipProvider } from "@/contexts/BetSlipContext";
import Index from "./pages/Index";
import PlayerProfile from "./pages/PlayerProfile";
import TeamProfile from "./pages/TeamProfile";
import BetSlip from "./pages/BetSlip";
import Decisions from "./pages/Decisions";
import Parlays from "./pages/Parlays";
import ImportData from "./pages/ImportData";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BetSlipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/player/:id" element={<PlayerProfile />} />
            <Route path="/player/api/:id" element={<PlayerProfile />} />
            <Route path="/team/:id" element={<TeamProfile />} />
            <Route path="/betslip" element={<BetSlip />} />
            <Route path="/decisions" element={<Decisions />} />
            <Route path="/parlays" element={<Parlays />} />
            <Route path="/import" element={<ImportData />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </BetSlipProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
