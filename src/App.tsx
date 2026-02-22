import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Quotes from "./pages/Quotes";
import Accounts from "./pages/Accounts";
import AccountsCallback from "./pages/AccountsCallback";
import Bots from "./pages/Bots";
import VPS from "./pages/VPS";
import Strategies from "./pages/Strategies";
import AskAI from "./pages/AskAI";
import HFT from "./pages/HFT";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="max-w-lg mx-auto relative min-h-screen">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/accounts/callback" element={<AccountsCallback />} />
              <Route path="/bots" element={<Bots />} />
              <Route path="/vps" element={<VPS />} />
              <Route path="/strategies" element={<Strategies />} />
              <Route path="/hft" element={<HFT />} />
              <Route path="/ask-ai" element={<AskAI />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
