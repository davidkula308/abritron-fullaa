 import { useState, useEffect } from "react";
 import { Plus, Bot as BotIcon, Loader2 } from "lucide-react";
import BotCard from "@/components/BotCard";
import AddBotDialog from "@/components/AddBotDialog";
import BotSettingsDialog from "@/components/BotSettingsDialog";
import BotLaunchDialog from "@/components/BotLaunchDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTrade } from "@/hooks/useTrade";
 import type { Bot, BotParameter } from "@/types/bot";
 import { useBots } from "@/hooks/useBots";
 import { useAuth } from "@/hooks/useAuth";
 import AuthDialog from "@/components/AuthDialog";
import TradeExecutionPanel from "@/components/TradeExecutionPanel";
import TradeSafetyPanel from "@/components/TradeSafetyPanel";
import PositionsPanel from "@/components/PositionsPanel";

 const Bots = () => {
   const { toast } = useToast();
   const { user } = useAuth();
   const { closeTrade } = useTrade();
   const { bots, loading, saveBot, deleteBot: removeBot, updateBotStatus } = useBots();
   const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
   const [settingsBot, setSettingsBot] = useState<Bot | null>(null);
   const [launchBot, setLaunchBot] = useState<Bot | null>(null);
   const [isStoppingBot, setIsStoppingBot] = useState<string | null>(null);
   const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
   const [showTradePanel, setShowTradePanel] = useState(false);

 
   const handleBotAdded = async (newBot: Bot) => {
     try {
       await saveBot(newBot);
       toast({
         title: "Bot Added",
         description: `${newBot.name} has been added`,
       });
     } catch (err) {
       toast({
         title: "Error",
         description: err instanceof Error ? err.message : "Failed to add bot",
         variant: "destructive",
       });
     }
  };

 
   const handleSaveSettings = async (botId: string, parameters: BotParameter[]) => {
     const bot = bots.find(b => b.id === botId);
     if (!bot) return;
 
     try {
       await saveBot({ ...bot, parameters });
     } catch (err) {
       toast({
         title: "Error",
         description: err instanceof Error ? err.message : "Failed to save settings",
         variant: "destructive",
       });
     }
  };

 
   const handleLaunchBot = async (botId: string, pair: string, timeframe: string, accountId: string) => {
     try {
       await updateBotStatus(botId, 'running', {
         selectedPair: pair,
         selectedTimeframe: timeframe,
         accountId: accountId,
         openPositions: [],
       });
       toast({
         title: "Bot Launched",
         description: `Bot is now running on ${pair}`,
       });
     } catch (err) {
       toast({
         title: "Error",
         description: err instanceof Error ? err.message : "Failed to launch bot",
         variant: "destructive",
       });
     }
  };

 
   const handleStopBot = async (id: string) => {
     const bot = bots.find(b => b.id === id);
     if (!bot) return;
 
     setIsStoppingBot(id);
 
     try {
       // Close all open positions for this bot
       if (bot.openPositions && bot.openPositions.length > 0 && bot.accountId) {
         for (const positionId of bot.openPositions) {
           await closeTrade(bot.accountId, positionId);
         }
         toast({
           title: "Positions Closed",
           description: `Closed ${bot.openPositions.length} position(s) for ${bot.name}`,
         });
       }
 
       await updateBotStatus(id, 'stopped', { openPositions: [] });
       
       toast({
         title: "Bot Stopped",
         description: `${bot.name} has been stopped`,
       });
     } catch (error) {
       toast({
         title: "Error Stopping Bot",
         description: error instanceof Error ? error.message : "Failed to close positions",
         variant: "destructive",
       });
     } finally {
       setIsStoppingBot(null);
     }
  };

 
   const handleDeleteBot = async (id: string) => {
     const bot = bots.find((b) => b.id === id);
     if (bot?.status === "running") {
       toast({
         title: "Cannot Delete",
         description: "Stop the bot before deleting",
         variant: "destructive",
       });
       return;
     }
 
     try {
       await removeBot(id);
       toast({
         title: "Bot Removed",
         description: `${bot?.name} has been deleted`,
       });
     } catch (err) {
       toast({
         title: "Error",
         description: err instanceof Error ? err.message : "Failed to delete bot",
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
               <BotIcon className="w-5 h-5 text-primary" />
             </div>
             <div>
               <h1 className="font-cyber text-xl font-bold tracking-wider">
                 TRADING <span className="text-primary">BOTS</span>
               </h1>
               <p className="text-xs text-muted-foreground">
                 Manage your trading bots
               </p>
             </div>
           </div>
         </div>
         
         <div className="px-4 py-16 text-center">
           <BotIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
           <h3 className="font-cyber text-lg font-semibold mb-2">Sign In Required</h3>
           <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
             Sign in to add and manage trading bots
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
           <div>
             <h1 className="font-cyber text-xl font-bold tracking-wider">
               TRADING <span className="text-primary">BOTS</span>
             </h1>
             <p className="text-xs text-muted-foreground">
               {bots.filter((b) => b.status === "running").length} of {bots.length} running
             </p>
           </div>
           <div className="flex gap-2">
             <Button 
               variant="outline"
               size="sm"
               className="font-cyber text-xs"
               onClick={() => setShowTradePanel(!showTradePanel)}
             >
               {showTradePanel ? "Hide" : "Quick Trade"}
             </Button>
             <Button 
               className="font-cyber text-xs gap-2"
               onClick={() => setIsAddDialogOpen(true)}
             >
               <Plus className="w-4 h-4" />
               Add Bot
             </Button>
           </div>
         </div>
       </div>

 
        {/* Trade Panel */}
        {showTradePanel && (
          <div className="px-4 pt-4 space-y-4">
            <TradeSafetyPanel />
            <TradeExecutionPanel />
          </div>
        )}

        {/* Positions Panel */}
        <div className="px-4 pt-4">
          <PositionsPanel />
        </div>
 
       {/* Bots List */}
       <div className="px-4 py-4">
         {loading ? (
           <div className="flex items-center justify-center py-16">
             <Loader2 className="w-8 h-8 animate-spin text-primary" />
           </div>
         ) : bots.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <BotIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-cyber text-lg font-semibold mb-2">No Bots Added</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
              Add your MQL4 or MQL5 Expert Advisors to automate your trading
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="font-cyber">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Bot
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onToggle={() => handleStopBot(bot.id)}
                onDelete={() => handleDeleteBot(bot.id)}
                onOpenSettings={() => setSettingsBot(bot)}
                onOpenLaunch={() => setLaunchBot(bot)}
                isStopping={isStoppingBot === bot.id}
              />
            ))}
          </div>
        )}
      </div>

       {/* Dialogs */}
       <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      <AddBotDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onBotAdded={handleBotAdded}
      />
      
      <BotSettingsDialog
        open={!!settingsBot}
        onOpenChange={(open) => !open && setSettingsBot(null)}
        bot={settingsBot}
        onSaveSettings={handleSaveSettings}
      />

      <BotLaunchDialog
        open={!!launchBot}
        onOpenChange={(open) => !open && setLaunchBot(null)}
        bot={launchBot}
        onLaunchBot={handleLaunchBot}
      />
    </div>
  );
};

export default Bots;
