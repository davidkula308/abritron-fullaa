import { Home, LineChart, Wallet, Bot, TrendingUp, MessageSquare } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import AppMenu from "./AppMenu";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/quotes", icon: LineChart, label: "Quotes" },
  { path: "/accounts", icon: Wallet, label: "Accounts" },
  { path: "/bots", icon: Bot, label: "Bots" },
  { path: "/ask-ai", icon: MessageSquare, label: "Arbitron" },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-all duration-300",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  isActive && "bg-primary/20 box-glow"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-glow")} />
              </div>
              <span className={cn(
                "text-xs font-medium mt-1 font-cyber tracking-wider",
                isActive && "text-glow"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <div className="flex flex-col items-center justify-center flex-1 h-full">
          <AppMenu />
          <span className="text-xs font-medium mt-1 font-cyber tracking-wider text-muted-foreground">More</span>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
