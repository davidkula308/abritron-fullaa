import { Activity, TrendingUp, Shield, Zap } from "lucide-react";
import cyberRobot from "@/assets/cyber-robot.png";

const Home = () => {
  return (
    <div className="min-h-screen pb-20 gradient-cyber">
      {/* Hero Section */}
      <div className="relative h-[70vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        
        {/* Robot Image with Blended Edges */}
        <div className="relative z-10 animate-float">
          <div 
            className="relative"
            style={{
              maskImage: "radial-gradient(ellipse 70% 80% at center, black 30%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 80% at center, black 30%, transparent 70%)",
            }}
          >
            <img 
              src={cyberRobot} 
              alt="Cyber Trading Robot" 
              className="w-72 h-auto"
              style={{
                filter: "drop-shadow(0 0 40px hsl(0 84% 50% / 0.6))"
              }}
            />
          </div>
          {/* Additional glow effect behind the image */}
          <div 
            className="absolute inset-0 -z-10 blur-2xl opacity-50"
            style={{
              background: "radial-gradient(circle at center, hsl(0 84% 50% / 0.3) 0%, transparent 70%)"
            }}
          />
        </div>

        {/* Scan Line Effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-scan-line" />
        </div>

        {/* Title */}
        <div className="relative z-10 text-center mt-6 px-6">
          <h1 className="font-cyber text-3xl font-bold tracking-wider text-glow mb-2">
            CYBER<span className="text-primary">TRADE</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Advanced algorithmic trading powered by artificial intelligence
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-4 -mt-10 relative z-20">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card/80 backdrop-blur-lg border border-border rounded-xl p-4 text-center hover:border-primary/50 transition-all">
            <Activity className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="font-cyber text-lg font-bold">24/7</p>
            <p className="text-xs text-muted-foreground">Active Trading</p>
          </div>
          <div className="bg-card/80 backdrop-blur-lg border border-border rounded-xl p-4 text-center hover:border-primary/50 transition-all">
            <TrendingUp className="w-6 h-6 text-profit mx-auto mb-2" />
            <p className="font-cyber text-lg font-bold">+85%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
          <div className="bg-card/80 backdrop-blur-lg border border-border rounded-xl p-4 text-center hover:border-primary/50 transition-all">
            <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="font-cyber text-lg font-bold">256-bit</p>
            <p className="text-xs text-muted-foreground">Encryption</p>
          </div>
          <div className="bg-card/80 backdrop-blur-lg border border-border rounded-xl p-4 text-center hover:border-primary/50 transition-all">
            <Zap className="w-6 h-6 text-accent mx-auto mb-2" />
            <p className="font-cyber text-lg font-bold">&lt;1ms</p>
            <p className="text-xs text-muted-foreground">Execution</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-6">
        <h2 className="font-cyber text-sm font-semibold tracking-wider mb-3 text-muted-foreground">
          QUICK START
        </h2>
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/60 transition-all box-glow">
            <div className="p-3 rounded-lg bg-primary/20">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">View Live Quotes</h3>
              <p className="text-xs text-muted-foreground">Real-time forex market data</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-all">
            <div className="p-3 rounded-lg bg-secondary">
              <Shield className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Link Your Account</h3>
              <p className="text-xs text-muted-foreground">Connect MT4/MT5 accounts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
