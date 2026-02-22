 import { useState, useEffect } from "react";
import { 
  LineChart, Plus, Play, Pause, Settings, Trash2, Mail, 
  TrendingUp, TrendingDown, AlertTriangle, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AuthDialog from "@/components/AuthDialog";
import IndicatorStrategyBuilder from "@/components/IndicatorStrategyBuilder";
import AdvancedStrategyPanel from "@/components/AdvancedStrategyPanel";
import StrategySettingsDialog from "@/components/StrategySettingsDialog";
 import type { Strategy, AdvancedStrategyType } from "@/types/strategy";
 import { ADVANCED_STRATEGIES } from "@/types/strategy";
 import { useStrategies } from "@/hooks/useStrategies";

 const Strategies = () => {
   const { toast } = useToast();
   const { user } = useAuth();
   const { strategies, saveStrategy, deleteStrategy: removeStrategy, toggleStrategy } = useStrategies();
   const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
   const [isBuilderOpen, setIsBuilderOpen] = useState(false);
   const [selectedAdvancedStrategy, setSelectedAdvancedStrategy] = useState<AdvancedStrategyType | null>(null);
   const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
   const [activeTab, setActiveTab] = useState("indicator");

 
   const handleSaveStrategy = async (strategy: Strategy) => {
     try {
       await saveStrategy(strategy);
      toast({
         title: editingStrategy ? "Strategy Updated" : "Strategy Created",
         description: `${strategy.name} has been ${editingStrategy ? "updated" : "added"}`,
      });
     } catch (err) {
      toast({
         title: "Error",
         description: err instanceof Error ? err.message : "Failed to save strategy",
         variant: "destructive",
      });
    }
    setIsBuilderOpen(false);
    setSelectedAdvancedStrategy(null);
    setEditingStrategy(null);
  };

 
   const handleToggleStrategy = async (id: string) => {
     const strategy = strategies.find(s => s.id === id);
     if (!strategy) return;
 
     const newStatus = !strategy.isActive;
     try {
       await toggleStrategy(id, newStatus);
       toast({
         title: newStatus ? "Strategy Deployed" : "Strategy Stopped",
         description: `${strategy.name} is now ${newStatus ? "running" : "stopped"}`,
       });
     } catch (err) {
       toast({
         title: "Error",
         description: err instanceof Error ? err.message : "Failed to toggle strategy",
         variant: "destructive",
       });
     }
  };

 
   const handleDeleteStrategy = async (id: string) => {
    const strategy = strategies.find(s => s.id === id);
     try {
       await removeStrategy(id);
       toast({
         title: "Strategy Deleted",
         description: `${strategy?.name} has been removed`,
       });
     } catch (err) {
       toast({
         title: "Error",
         description: err instanceof Error ? err.message : "Failed to delete strategy",
         variant: "destructive",
       });
     }
  };

  if (!user) {
    return (
      <div className="min-h-screen pb-20 bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 box-glow">
              <LineChart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-cyber text-xl font-bold tracking-wider">
                TRADING <span className="text-primary">STRATEGIES</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Automated trading with indicators
              </p>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-16 text-center">
          <LineChart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-cyber text-lg font-semibold mb-2">Sign In Required</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
            Sign in to create and deploy trading strategies
          </p>
          <Button onClick={() => setIsAuthDialogOpen(true)} className="font-cyber">
            Sign In / Sign Up
          </Button>
        </div>
        
        <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 box-glow">
              <LineChart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-cyber text-xl font-bold tracking-wider">
                TRADING <span className="text-primary">STRATEGIES</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {strategies.length} strategies • {strategies.filter(s => s.isActive).length} active
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Strategy Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="indicator" className="flex-1 gap-1">
              <TrendingUp className="w-3 h-3" />
              Indicators
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex-1 gap-1">
              <Zap className="w-3 h-3" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="indicator" className="mt-4 space-y-4">
            {/* Create Strategy Button */}
            <Button 
              onClick={() => setIsBuilderOpen(true)}
              className="w-full font-cyber gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Indicator Strategy
            </Button>

            {/* Active Strategies */}
            {strategies.filter(s => s.type === "indicator").length > 0 && (
              <div className="space-y-3">
                <h3 className="font-cyber text-sm text-muted-foreground">YOUR STRATEGIES</h3>
                {strategies.filter(s => s.type === "indicator").map((strategy) => (
                  <StrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    onToggle={() => handleToggleStrategy(strategy.id)}
                    onEdit={() => {
                      setEditingStrategy(strategy);
                      setIsBuilderOpen(true);
                    }}
                    onDelete={() => handleDeleteStrategy(strategy.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="mt-4 space-y-4">
            {/* Advanced Strategy Cards */}
            <div className="grid grid-cols-2 gap-3">
              {ADVANCED_STRATEGIES.map((strategy) => (
                <Card 
                  key={strategy.type}
                  className="cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => setSelectedAdvancedStrategy(strategy.type)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                      strategy.type === "FVG" ? "bg-green-500/20 text-green-500" :
                      strategy.type === "LIQUIDITY_SWEEP" ? "bg-amber-500/20 text-amber-500" :
                      strategy.type === "ORDER_BLOCK" ? "bg-blue-500/20 text-blue-500" :
                      "bg-purple-500/20 text-purple-500"
                    }`}>
                      <Zap className="w-5 h-5" />
                    </div>
                    <h4 className="font-cyber text-xs font-semibold">{strategy.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {strategy.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Active Advanced Strategies */}
            {strategies.filter(s => s.type === "advanced").length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="font-cyber text-sm text-muted-foreground">ACTIVE ADVANCED STRATEGIES</h3>
                {strategies.filter(s => s.type === "advanced").map((strategy) => (
                  <StrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    onToggle={() => handleToggleStrategy(strategy.id)}
                    onEdit={() => {
                      setEditingStrategy(strategy);
                      setSelectedAdvancedStrategy(strategy.advancedType!);
                    }}
                    onDelete={() => handleDeleteStrategy(strategy.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      
      <IndicatorStrategyBuilder
        open={isBuilderOpen}
        onOpenChange={setIsBuilderOpen}
        onSave={handleSaveStrategy}
        editingStrategy={editingStrategy}
      />

      <AdvancedStrategyPanel
        open={!!selectedAdvancedStrategy}
        onOpenChange={(open) => !open && setSelectedAdvancedStrategy(null)}
        strategyType={selectedAdvancedStrategy}
        onSave={handleSaveStrategy}
        editingStrategy={editingStrategy}
      />
    </div>
  );
};

interface StrategyCardProps {
  strategy: Strategy;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const StrategyCard = ({ strategy, onToggle, onEdit, onDelete }: StrategyCardProps) => {
  return (
    <Card className={strategy.isActive ? "border-primary/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${strategy.isActive ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
            <span className="font-medium text-sm">{strategy.name}</span>
          </div>
          <Badge variant={strategy.isActive ? "default" : "secondary"} className="text-xs">
            {strategy.isActive ? "Running" : "Stopped"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Badge variant="outline" className="text-xs">
            {strategy.type === "indicator" ? strategy.indicatorType : strategy.advancedType}
          </Badge>
          {strategy.selectedPair && (
            <span>{strategy.selectedPair}</span>
          )}
          {strategy.selectedTimeframe && (
            <span>{strategy.selectedTimeframe}</span>
          )}
          {strategy.action && (
            <Badge variant={strategy.action === "BUY" ? "default" : strategy.action === "SELL" ? "destructive" : "secondary"} className="text-xs">
              {strategy.action}
            </Badge>
          )}
        </div>

        {strategy.notificationEmail && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <Mail className="w-3 h-3" />
            <span>{strategy.notificationEmail}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={strategy.isActive ? "destructive" : "default"}
            onClick={onToggle}
            className="flex-1 gap-1"
          >
            {strategy.isActive ? (
              <>
                <Pause className="w-3 h-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Deploy
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Settings className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Strategies;
