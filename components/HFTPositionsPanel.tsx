import { X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HFTPosition } from "@/hooks/useHFT";

interface HFTPositionsPanelProps {
  positions: HFTPosition[];
  isLoading: boolean;
  onRefresh: () => void;
  onClose: (positionId: number, volume: number) => void;
}

const HFTPositionsPanel = ({ positions, isLoading, onRefresh, onClose }: HFTPositionsPanelProps) => {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-cyber text-sm flex items-center gap-2">
            Open Positions
            <Badge variant="outline" className="text-xs">{positions.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {positions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No open HFT positions</p>
        )}
        {positions.map((pos) => (
          <div key={pos.positionId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Badge variant={pos.side === "BUY" ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                  {pos.side}
                </Badge>
                <span className="text-xs font-medium">#{pos.positionId}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Vol: {pos.volume} • Entry: {pos.entryPrice}
                {pos.stopLoss ? ` • SL: ${pos.stopLoss}` : ""}
                {pos.takeProfit ? ` • TP: ${pos.takeProfit}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onClose(pos.positionId, pos.volume)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default HFTPositionsPanel;
