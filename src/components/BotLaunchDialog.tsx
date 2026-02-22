import { useState, useEffect } from "react";
import { Play, TrendingUp, Clock, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTradingAccounts } from "@/hooks/useTradingAccounts";
import { useTrade } from "@/hooks/useTrade";
import { FOREX_PAIRS, TIMEFRAMES, type Bot } from "@/types/bot";

interface BotLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: Bot | null;
  onLaunchBot: (botId: string, pair: string, timeframe: string, accountId: string) => void;
}

const BotLaunchDialog = ({ open, onOpenChange, bot, onLaunchBot }: BotLaunchDialogProps) => {
  const { toast } = useToast();
  const { accounts, loading: accountsLoading } = useTradingAccounts();
  const { openTrade } = useTrade();
  
  const [selectedPair, setSelectedPair] = useState<string>("");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [isLaunching, setIsLaunching] = useState(false);

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPair("");
      setSelectedTimeframe("");
      setSelectedAccount("");
    }
  }, [open]);

  // Auto-select first account if only one exists
  useEffect(() => {
    if (accounts.length === 1 && !selectedAccount) {
      setSelectedAccount(accounts[0].id); // Use DB UUID, not cTrader account_id
    }
  }, [accounts, selectedAccount]);

  const handleLaunch = async () => {
    if (!selectedPair) {
      toast({
        title: "Select Trading Pair",
        description: "Please select a trading pair before launching",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTimeframe) {
      toast({
        title: "Select Timeframe",
        description: "Please select a timeframe before launching",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAccount) {
      toast({
        title: "Select Trading Account",
        description: "Please select a trading account before launching",
        variant: "destructive",
      });
      return;
    }

    if (!bot) return;

    setIsLaunching(true);

    try {
      // Get bot parameters
      const lotSize = bot.parameters.find(p => p.name === 'LotSize')?.value as number || 0.01;
      
      // Note: In a real implementation, the bot would analyze the market based on its algorithm
      // and decide when to open trades. For now, we're just setting up the connection.
      // The bot's logic would typically:
      // 1. Subscribe to price feeds for the selected pair/timeframe
      // 2. Run the EA's algorithm on incoming candles
      // 3. Execute trades based on signals
      
      toast({
        title: "Bot Connected",
        description: `${bot.name} is now monitoring ${selectedPair} on ${selectedTimeframe}. Trades will execute based on the bot's algorithm.`,
      });

      onLaunchBot(bot.id, selectedPair, selectedTimeframe, selectedAccount);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Launch Failed",
        description: error instanceof Error ? error.message : "Failed to launch bot",
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  if (!bot) return null;

  const selectedAccountData = accounts.find(a => a.id === selectedAccount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="font-cyber text-lg tracking-wider flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Launch {bot.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select the trading account, pair and timeframe for your bot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trading Account Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Trading Account
            </Label>
            {accountsLoading ? (
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading accounts...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-sm text-destructive">
                  No trading accounts connected. Please connect an account first.
                </p>
              </div>
            ) : (
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select trading account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <span>{account.broker_name || 'Unknown Broker'}</span>
                        <span className="text-xs text-muted-foreground">
                          ({account.is_live ? 'Live' : 'Demo'})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedAccountData && (
              <p className="text-xs text-muted-foreground">
                Balance: ${selectedAccountData.balance?.toLocaleString() || '0'} • 
                Leverage: {selectedAccountData.leverage || 'N/A'}
              </p>
            )}
          </div>

          {/* Trading Pair Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Trading Pair
            </Label>
            <Select value={selectedPair} onValueChange={setSelectedPair}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select trading pair" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {FOREX_PAIRS.map((pair) => (
                  <SelectItem key={pair} value={pair}>
                    {pair}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Timeframe
            </Label>
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          {selectedPair && selectedTimeframe && selectedAccount && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-sm text-center">
                <span className="font-cyber text-primary">{bot.name}</span> will trade on
              </p>
              <p className="text-center font-semibold mt-1">
                {selectedPair} • {TIMEFRAMES.find(t => t.value === selectedTimeframe)?.label}
              </p>
              <p className="text-xs text-center text-muted-foreground mt-1">
                via {selectedAccountData?.broker_name || 'Trading Account'}
              </p>
            </div>
          )}
        </div>

        <Button 
          onClick={handleLaunch} 
          className="w-full font-cyber gap-2"
          disabled={!selectedPair || !selectedTimeframe || !selectedAccount || isLaunching || accounts.length === 0}
        >
          {isLaunching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Launching...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Launch Bot
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default BotLaunchDialog;
