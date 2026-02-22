import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { X, RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Loader2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTrade, Position } from "@/hooks/useTrade";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  accountId: string; // cTrader numeric account_id
  accountDbId: string; // DB uuid
}

const AIPositionsMonitor = ({ accountId, accountDbId }: Props) => {
  const { getPositions, closeTrade, modifyTrade } = useTrade();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [modifyPos, setModifyPos] = useState<Position | null>(null);
  const [newSL, setNewSL] = useState("");
  const [newTP, setNewTP] = useState("");
  const [modifying, setModifying] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!accountId || !user) return;
    setLoading(true);
    try {
      const pos = await getPositions(accountId);
      setPositions(pos);
    } catch {
      // silent fail on auto-refresh
    } finally {
      setLoading(false);
    }
  }, [accountId, getPositions, user]);

  useEffect(() => {
    if (!accountId || authLoading || !user) return;
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, [accountId, fetchPositions, authLoading, user]);

  const handleClose = async (positionId: string) => {
    setClosingId(positionId);
    try {
      await closeTrade(accountId, positionId);
      toast({ title: "Position Closed", description: `#${positionId} closed` });
      fetchPositions();
    } catch (err) {
      toast({ title: "Close Failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setClosingId(null);
    }
  };

  const handleModify = async () => {
    if (!modifyPos) return;
    setModifying(true);
    try {
      await modifyTrade(accountId, modifyPos.positionId, newSL ? parseFloat(newSL) : undefined, newTP ? parseFloat(newTP) : undefined);
      toast({ title: "Position Updated" });
      setModifyPos(null);
      fetchPositions();
    } catch (err) {
      toast({ title: "Modify Failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setModifying(false);
    }
  };

  const totalProfit = positions.reduce((sum, p) => sum + (p.profit ?? 0), 0);

  return (
    <>
      <div className="mx-4 mb-2 rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="font-cyber text-xs font-semibold tracking-wider">OPEN POSITIONS</span>
            <span className="text-xs text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">
              {positions.length}
            </span>
            {positions.length > 0 && (
              <span className={cn("text-xs font-semibold", totalProfit >= 0 ? "text-green-500" : "text-red-500")}>
                {totalProfit >= 0 ? "+" : ""}{totalProfit.toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <RefreshCw
              className={cn("w-3 h-3 text-muted-foreground", loading && "animate-spin")}
              onClick={(e) => { e.stopPropagation(); fetchPositions(); }}
            />
            {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </button>

        {/* Body */}
        {!collapsed && (
          <div className="px-3 pb-2 space-y-1.5 max-h-64 overflow-y-auto">
            {loading && positions.length === 0 ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : positions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No open positions</p>
            ) : (
              positions.map((pos) => {
                const isBuy = pos.side === "BUY";
                const isProfit = (pos.profit ?? 0) >= 0;
                return (
                  <div key={pos.positionId} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 border border-border/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {isBuy ? (
                          <TrendingUp className="w-3 h-3 text-green-500 shrink-0" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
                        )}
                        <span className="font-cyber text-xs font-bold">{pos.symbol}</span>
                        <span className={cn("text-[10px] px-1 rounded font-semibold", isBuy ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}>
                          {pos.side}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{pos.volume}L</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        @ {pos.entryPrice} &nbsp;|&nbsp; SL: {pos.stopLoss ?? "—"} &nbsp;|&nbsp; TP: {pos.takeProfit ?? "—"}
                      </div>
                    </div>
                    <span className={cn("text-xs font-bold shrink-0", isProfit ? "text-green-500" : "text-red-500")}>
                      {isProfit ? "+" : ""}{(pos.profit ?? 0).toFixed(2)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 hover:bg-secondary/80"
                      onClick={() => { setModifyPos(pos); setNewSL(pos.stopLoss?.toString() ?? ""); setNewTP(pos.takeProfit?.toString() ?? ""); }}
                    >
                      <Edit className="w-2.5 h-2.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 text-red-500 hover:bg-red-500/10"
                      onClick={() => handleClose(pos.positionId)}
                      disabled={closingId === pos.positionId}
                    >
                      {closingId === pos.positionId ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <X className="w-2.5 h-2.5" />}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modify SL/TP Dialog */}
      <Dialog open={!!modifyPos} onOpenChange={(open) => !open && setModifyPos(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-cyber text-sm">Modify {modifyPos?.symbol} {modifyPos?.side}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Stop Loss</Label>
              <Input value={newSL} onChange={(e) => setNewSL(e.target.value)} placeholder="Price" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Take Profit</Label>
              <Input value={newTP} onChange={(e) => setNewTP(e.target.value)} placeholder="Price" className="h-8 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleModify} disabled={modifying} className="font-cyber text-xs w-full">
              {modifying && <Loader2 className="w-3 h-3 animate-spin mr-1" />} Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIPositionsMonitor;
