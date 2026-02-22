import { useState, useEffect, useCallback } from "react";
import { RefreshCw, X, Edit, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTradingAccounts } from "@/hooks/useTradingAccounts";
import { useTrade, Position } from "@/hooks/useTrade";
import { cn } from "@/lib/utils";

const PositionsPanel = () => {
  const { toast } = useToast();
  const { accounts } = useTradingAccounts();
  const { getPositions, closeTrade, modifyTrade } = useTrade();

  const [accountId, setAccountId] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [modifyPos, setModifyPos] = useState<Position | null>(null);
  const [newSL, setNewSL] = useState("");
  const [newTP, setNewTP] = useState("");
  const [modifying, setModifying] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const pos = await getPositions(accountId);
      setPositions(pos);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to fetch positions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [accountId, getPositions, toast]);

  // Auto-refresh positions every 5 seconds for live P/L
  useEffect(() => {
    if (!accountId) return;
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = async (positionId: string) => {
    setClosingId(positionId);
    try {
      await closeTrade(accountId, positionId);
      toast({ title: "Position Closed", description: `Position ${positionId} closed` });
      fetchPositions();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to close", variant: "destructive" });
    } finally {
      setClosingId(null);
    }
  };

  const handleModify = async () => {
    if (!modifyPos) return;
    setModifying(true);
    try {
      await modifyTrade(
        accountId,
        modifyPos.positionId,
        newSL ? parseFloat(newSL) : undefined,
        newTP ? parseFloat(newTP) : undefined,
      );
      toast({ title: "Position Updated" });
      setModifyPos(null);
      fetchPositions();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to modify", variant: "destructive" });
    } finally {
      setModifying(false);
    }
  };

  const openModifyDialog = (pos: Position) => {
    setModifyPos(pos);
    setNewSL(pos.stopLoss?.toString() ?? "");
    setNewTP(pos.takeProfit?.toString() ?? "");
  };

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-cyber text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Open Positions
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={fetchPositions} disabled={!accountId || loading}>
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select account to view positions" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.account_id}>
                  {acc.broker_name || "Account"} ({acc.is_live ? "Live" : "Demo"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : positions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {accountId ? "No open positions" : "Select an account"}
            </p>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => {
                const isBuy = pos.side === "BUY";
                const isProfit = (pos.profit ?? 0) >= 0;
                return (
                  <div key={pos.positionId} className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isBuy ? (
                          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                        )}
                        <span className="font-cyber text-xs font-semibold">{pos.symbol}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded", isBuy ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}>
                          {pos.side}
                        </span>
                      </div>
                      <span className={cn("text-xs font-semibold", isProfit ? "text-green-500" : "text-red-500")}>
                        {isProfit ? "+" : ""}{(pos.profit ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground mb-2">
                      <span>Vol: {pos.volume}</span>
                      <span>Entry: {pos.entryPrice}</span>
                      <span>SL/TP: {pos.stopLoss ?? "—"}/{pos.takeProfit ?? "—"}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleClose(pos.positionId)}
                        disabled={closingId === pos.positionId}
                      >
                        {closingId === pos.positionId ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                        Close
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={() => openModifyDialog(pos)}
                      >
                        <Edit className="w-3 h-3 mr-1" /> SL/TP
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modify SL/TP Dialog */}
      <Dialog open={!!modifyPos} onOpenChange={(open) => !open && setModifyPos(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-cyber text-sm">
              Modify {modifyPos?.symbol} {modifyPos?.side}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Stop Loss (price)</Label>
              <Input value={newSL} onChange={(e) => setNewSL(e.target.value)} placeholder="Absolute price" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Take Profit (price)</Label>
              <Input value={newTP} onChange={(e) => setNewTP(e.target.value)} placeholder="Absolute price" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleModify} disabled={modifying} className="font-cyber text-xs">
              {modifying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Update Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PositionsPanel;
