 import { useState, useEffect } from "react";
 import { 
   TrendingUp, Clock, DollarSign, Target, Shield, 
   Play, Loader2, Plus, Minus
 } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useTradeSafety } from "@/hooks/useTradeSafety";
import { FOREX_PAIRS, TIMEFRAMES } from "@/types/bot";
 
 // Get current Nairobi time (UTC+3)
 const getNairobiTime = () => {
   const now = new Date();
   // Nairobi is UTC+3
   const nairobiOffset = 3 * 60; // minutes
   const localOffset = now.getTimezoneOffset();
   const nairobiTime = new Date(now.getTime() + (nairobiOffset + localOffset) * 60000);
   
   const hours = nairobiTime.getHours().toString().padStart(2, '0');
   const minutes = nairobiTime.getMinutes().toString().padStart(2, '0');
   return `${hours}:${minutes}`;
 };
 
 interface TradeExecutionPanelProps {
   selectedAccountId?: string;
 }
 
 const TradeExecutionPanel = ({ selectedAccountId }: TradeExecutionPanelProps) => {
   const { toast } = useToast();
   const { accounts } = useTradingAccounts();
 
  const { openTrade } = useTrade();
  const { checkSafety, recordTrade, recordError } = useTradeSafety();
 
   const [accountId, setAccountId] = useState(selectedAccountId || "");
   const [pair, setPair] = useState("EURUSD");
   const [timeframe, setTimeframe] = useState("H1");
   const [numTrades, setNumTrades] = useState("1");
   const [lotSize, setLotSize] = useState("0.01");
   const [takeProfit, setTakeProfit] = useState("");
   const [stopLoss, setStopLoss] = useState("");
   const [tradeTime, setTradeTime] = useState(getNairobiTime());
   const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
   const [isExecuting, setIsExecuting] = useState(false);
 
   useEffect(() => {
     if (selectedAccountId) {
       setAccountId(selectedAccountId);
     }
   }, [selectedAccountId]);
 
   // Update time every minute
   useEffect(() => {
     const interval = setInterval(() => {
       if (!tradeTime) {
         setTradeTime(getNairobiTime());
       }
     }, 60000);
     return () => clearInterval(interval);
   }, [tradeTime]);
 
    const handleExecuteTrades = async () => {
      if (!accountId) {
        toast({ title: "Select Account", description: "Please select a trading account", variant: "destructive" });
        return;
      }

      const count = parseInt(numTrades) || 1;
      const lot = parseFloat(lotSize) || 0.01;
      const tp = takeProfit ? parseFloat(takeProfit) : undefined;
      const sl = stopLoss ? parseFloat(stopLoss) : undefined;

      // Safety check
      const safety = checkSafety(lot);
      if (!safety.allowed) {
        toast({ title: "Safety Block", description: safety.reason, variant: "destructive" });
        return;
      }

      setIsExecuting(true);

      try {
        for (let i = 0; i < count; i++) {
          await openTrade({ accountId, symbol: pair, volume: lot, side: tradeType, takeProfit: tp, stopLoss: sl });
          recordTrade();
        }
        toast({ title: "Trades Executed", description: `Successfully opened ${count} ${tradeType} position(s) on ${pair}` });
      } catch (error) {
        recordError();
        toast({ title: "Trade Failed", description: error instanceof Error ? error.message : "Failed to execute trades", variant: "destructive" });
      } finally {
        setIsExecuting(false);
      }
    };
 
   const handleInputChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
     setter(e.target.value);
   };
 
   return (
     <Card className="border-primary/30">
       <CardHeader className="pb-3">
         <CardTitle className="font-cyber text-sm flex items-center gap-2">
           <Play className="w-4 h-4 text-primary" />
           Quick Trade Panel
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Account Selection */}
         <div className="space-y-1">
           <Label className="text-xs">Trading Account</Label>
           <Select value={accountId} onValueChange={setAccountId}>
             <SelectTrigger className="h-9">
               <SelectValue placeholder="Select account" />
             </SelectTrigger>
             <SelectContent>
               {accounts.map((acc) => (
                 <SelectItem key={acc.id} value={acc.account_id}>
                   {acc.broker_name || 'Account'} ({acc.is_live ? 'Live' : 'Demo'})
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
 
         {/* Pair & Timeframe */}
         <div className="grid grid-cols-2 gap-2">
           <div className="space-y-1">
             <Label className="text-xs flex items-center gap-1">
               <TrendingUp className="w-3 h-3" /> Pair
             </Label>
             <Select value={pair} onValueChange={setPair}>
               <SelectTrigger className="h-9">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {FOREX_PAIRS.map((p) => (
                   <SelectItem key={p} value={p}>{p}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-1">
             <Label className="text-xs flex items-center gap-1">
               <Clock className="w-3 h-3" /> Timeframe
             </Label>
             <Select value={timeframe} onValueChange={setTimeframe}>
               <SelectTrigger className="h-9">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {TIMEFRAMES.map((tf) => (
                   <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
         </div>
 
         {/* Trade Type */}
         <div className="flex gap-2">
           <Button
             variant={tradeType === "BUY" ? "default" : "outline"}
             className={`flex-1 ${tradeType === "BUY" ? "bg-green-600 hover:bg-green-700" : ""}`}
             onClick={() => setTradeType("BUY")}
           >
             BUY
           </Button>
           <Button
             variant={tradeType === "SELL" ? "default" : "outline"}
             className={`flex-1 ${tradeType === "SELL" ? "bg-red-600 hover:bg-red-700" : ""}`}
             onClick={() => setTradeType("SELL")}
           >
             SELL
           </Button>
         </div>
 
         {/* Number of Trades & Lot Size */}
         <div className="grid grid-cols-2 gap-2">
           <div className="space-y-1">
             <Label className="text-xs flex items-center gap-1">
               <Plus className="w-3 h-3" /> Num Trades
             </Label>
             <Input
               type="text"
               inputMode="numeric"
               value={numTrades}
               onChange={handleInputChange(setNumTrades)}
               className="h-9"
               placeholder="1"
             />
           </div>
           <div className="space-y-1">
             <Label className="text-xs flex items-center gap-1">
               <DollarSign className="w-3 h-3" /> Lot Size
             </Label>
             <Input
               type="text"
               inputMode="decimal"
               value={lotSize}
               onChange={handleInputChange(setLotSize)}
               className="h-9"
               placeholder="0.01"
             />
           </div>
         </div>
 
         {/* TP & SL */}
         <div className="grid grid-cols-2 gap-2">
           <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Target className="w-3 h-3 text-green-500" /> Take Profit
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={takeProfit}
                onChange={handleInputChange(setTakeProfit)}
                className="h-9"
                placeholder="Price level (e.g. 2700)"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Shield className="w-3 h-3 text-red-500" /> Stop Loss
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={stopLoss}
                onChange={handleInputChange(setStopLoss)}
                className="h-9"
                placeholder="Price level (e.g. 2650)"
              />
           </div>
         </div>
 
         {/* Trade Time */}
         <div className="space-y-1">
           <Label className="text-xs flex items-center gap-1">
             <Clock className="w-3 h-3" /> Trade Time (Nairobi)
           </Label>
           <Input
             type="time"
             value={tradeTime}
             onChange={handleInputChange(setTradeTime)}
             className="h-9"
           />
         </div>
 
         {/* Execute Button */}
         <Button
           onClick={handleExecuteTrades}
           disabled={!accountId || isExecuting}
           className="w-full font-cyber gap-2"
         >
           {isExecuting ? (
             <>
               <Loader2 className="w-4 h-4 animate-spin" />
               Executing...
             </>
           ) : (
             <>
               <Play className="w-4 h-4" />
               Execute {numTrades || 1} Trade(s)
             </>
           )}
         </Button>
       </CardContent>
     </Card>
   );
 };
 
 export default TradeExecutionPanel;