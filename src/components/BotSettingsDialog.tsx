import { useState, useEffect } from "react";
import { Settings, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { Bot, BotParameter } from "@/types/bot";

interface BotSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: Bot | null;
  onSaveSettings: (botId: string, parameters: BotParameter[]) => void;
}

const BotSettingsDialog = ({ open, onOpenChange, bot, onSaveSettings }: BotSettingsDialogProps) => {
  const { toast } = useToast();
  const [parameters, setParameters] = useState<BotParameter[]>([]);

  useEffect(() => {
    if (bot) {
      setParameters([...bot.parameters]);
    }
  }, [bot]);

  const handleParameterChange = (index: number, value: number | boolean | string) => {
    const newParams = [...parameters];
    newParams[index] = { ...newParams[index], value };
    setParameters(newParams);
  };

  const handleResetToDefaults = () => {
    if (bot) {
      const resetParams = bot.parameters.map(p => ({ ...p, value: p.defaultValue }));
      setParameters(resetParams);
      toast({
        title: "Parameters Reset",
        description: "All parameters have been reset to default values",
      });
    }
  };

  const handleSave = () => {
    if (bot) {
      onSaveSettings(bot.id, parameters);
      onOpenChange(false);
      toast({
        title: "Settings Saved",
        description: `${bot.name} configuration has been updated`,
      });
    }
  };

  if (!bot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md mx-4 max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-cyber text-lg tracking-wider flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            {bot.name} Settings
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4 py-2">
            {parameters.map((param, index) => (
              <div key={param.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{param.name}</Label>
                  {param.description && (
                    <span className="text-xs text-muted-foreground">{param.description}</span>
                  )}
                </div>
                
                {param.type === "boolean" ? (
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={param.value as boolean}
                      onCheckedChange={(checked) => handleParameterChange(index, checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {param.value ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                ) : param.type === "number" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={param.value === 0 ? "0" : String(param.value)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || val === "-") {
                          handleParameterChange(index, val as any);
                        } else {
                          const num = parseFloat(val);
                          if (!isNaN(num)) handleParameterChange(index, num);
                        }
                      }}
                      className="bg-secondary border-border focus:border-primary"
                    />
                    {param.min !== undefined && param.max !== undefined && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {param.min} - {param.max}
                      </span>
                    )}
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={param.value as string}
                    onChange={(e) => handleParameterChange(index, e.target.value)}
                    className="bg-secondary border-border focus:border-primary"
                  />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleResetToDefaults}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button onClick={handleSave} className="font-cyber flex-1">
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BotSettingsDialog;
