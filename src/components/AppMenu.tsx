import { useState, useEffect } from "react";
import { Menu, X, Server, TrendingUp, Download, Home, LineChart, Wallet, Bot, MessageSquare, Zap } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const allPages = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/quotes", icon: LineChart, label: "Quotes" },
  { path: "/accounts", icon: Wallet, label: "Accounts" },
  { path: "/bots", icon: Bot, label: "Bots" },
  { path: "/ask-ai", icon: MessageSquare, label: "Arbitron AI" },
  { path: "/strategies", icon: TrendingUp, label: "Strategies" },
  { path: "/hft", icon: Zap, label: "HFT Bot" },
  { path: "/vps", icon: Server, label: "VPS Management" },
];

const AppMenu = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback: show instructions
      alert("To install: tap your browser's menu (⋮ or Share) → 'Add to Home Screen' or 'Install App'");
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 bg-card border-border">
        <SheetHeader>
          <SheetTitle className="font-cyber text-lg tracking-wider">
            ARBITRON<span className="text-primary">KING</span>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-1">
          {allPages.map((page) => {
            const isActive = location.pathname === page.path;
            return (
              <Link
                key={page.path}
                to={page.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                  isActive
                    ? "bg-primary/20 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <page.icon className="w-4 h-4" />
                {page.label}
              </Link>
            );
          })}
        </div>
        <div className="mt-6 pt-6 border-t border-border">
          <Button
            variant="outline"
            className="w-full gap-2 font-cyber text-xs"
            onClick={handleInstall}
          >
            <Download className="w-4 h-4" />
            Install App on Device
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AppMenu;
