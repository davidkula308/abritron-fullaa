import { useState, useEffect } from "react";
import { Zap, Save, Mail, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Strategy, AdvancedStrategyType, 
  ADVANCED_STRATEGIES, TIMEFRAMES_OPTIONS 
} from "@/types/strategy";
import { FOREX_PAIRS } from "@/types/bot";

interface AdvancedStrategyPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyType: AdvancedStrategyType | null;
  onSave: (strategy: Strategy) => void;
  editingStrategy?: Strategy | null;
}

const AdvancedStrategyPanel = ({ 
  open, 
  onOpenChange, 
  strategyType,
  onSave,
  editingStrategy
}: AdvancedStrategyPanelProps) => {
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [action, setAction] = useState<"BUY" | "SELL" | "BOTH">("BOTH");
  const [selectedPair, setSelectedPair] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [enableNotifications, setEnableNotifications] = useState(false);

  const strategyConfig = ADVANCED_STRATEGIES.find(s => s.type === strategyType);

  useEffect(() => {
    if (strategyConfig) {
      // Initialize default settings
      const defaults: Record<string, unknown> = {};
      strategyConfig.settings.forEach(s => {
        defaults[s.key] = s.defaultValue;
      });
      
      if (editingStrategy && editingStrategy.advancedType === strategyType) {
        setName(editingStrategy.name);
        setSettings(editingStrategy.settings);
        setAction(editingStrategy.action);
        setSelectedPair(editingStrategy.selectedPair || "");
        setNotificationEmail(editingStrategy.notificationEmail || "");
        setEnableNotifications(!!editingStrategy.notificationEmail);
      } else {
        setName(`${strategyConfig.name} Strategy`);
        setSettings(defaults);
        setAction("BOTH");
        setSelectedPair("");
        setNotificationEmail("");
        setEnableNotifications(false);
      }
    }
  }, [strategyConfig, strategyType, editingStrategy, open]);

  const handleSave = () => {
    if (!name || !selectedPair || !strategyType) return;

    const strategy: Strategy = {
      id: editingStrategy?.id || crypto.randomUUID(),
      name,
      type: "advanced",
      advancedType: strategyType,
      conditions: [],
      settings,
      action,
      isActive: false,
      selectedPair,
      selectedTimeframe: settings.timeframe as string || "H1",
      notificationEmail: enableNotifications ? notificationEmail : undefined,
      createdAt: editingStrategy?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(strategy);
  };

  if (!strategyConfig) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-cyber flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {strategyConfig.name}
          </SheetTitle>
          <SheetDescription>
            {strategyConfig.description}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4 mt-4">
          <div className="space-y-4">
            {/* Strategy Name */}
            <div className="space-y-2">
              <Label>Strategy Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Trading Pair */}
            <div className="space-y-2">
              <Label>Trading Pair</Label>
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pair" />
                </SelectTrigger>
                <SelectContent>
                  {FOREX_PAIRS.map((pair) => (
                    <SelectItem key={pair} value={pair}>{pair}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strategy Settings */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Strategy Settings</Label>
              
              {strategyConfig.settings.map((setting) => (
                <div key={setting.key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">{setting.name}</Label>
                    {setting.description && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[200px]">{setting.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  
                   {setting.type === "number" && (
                     <Input
                       type="text"
                       inputMode="decimal"
                       value={settings[setting.key]?.toString() ?? setting.defaultValue.toString()}
                       onChange={(e) => {
                         const val = e.target.value;
                         setSettings({
                           ...settings,
                           [setting.key]: val === '' ? '' : (parseFloat(val) || val)
                         });
                       }}
                       onBlur={(e) => {
                         const val = e.target.value;
                         if (val === '' || isNaN(parseFloat(val))) {
                           setSettings({
                             ...settings,
                             [setting.key]: setting.defaultValue
                           });
                         }
                       }}
                     />
                   )}
                  
                  {setting.type === "boolean" && (
                    <Switch
                      checked={settings[setting.key] as boolean}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        [setting.key]: checked
                      })}
                    />
                  )}
                  
                  {setting.type === "color" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings[setting.key] as string}
                        onChange={(e) => setSettings({
                          ...settings,
                          [setting.key]: e.target.value
                        })}
                        className="w-10 h-10 rounded border-0 cursor-pointer"
                      />
                      <Input
                        value={settings[setting.key] as string}
                        onChange={(e) => setSettings({
                          ...settings,
                          [setting.key]: e.target.value
                        })}
                        className="flex-1"
                      />
                    </div>
                  )}
                  
                  {setting.type === "timeframe" && (
                    <Select 
                      value={settings[setting.key] as string} 
                      onValueChange={(v) => setSettings({
                        ...settings,
                        [setting.key]: v
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEFRAMES_OPTIONS.map((tf) => (
                          <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {setting.type === "select" && setting.options && (
                    <Select 
                      value={settings[setting.key] as string} 
                      onValueChange={(v) => setSettings({
                        ...settings,
                        [setting.key]: v
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {setting.options.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>

            {/* Action */}
            <div className="space-y-2 border-t pt-4">
              <Label>Trade Action</Label>
              <div className="flex gap-2">
                {(["BUY", "SELL", "BOTH"] as const).map((a) => (
                  <Button
                    key={a}
                    variant={action === a ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAction(a)}
                    className={`flex-1 ${
                      a === "BUY" && action === a ? "bg-green-600 hover:bg-green-700" :
                      a === "SELL" && action === a ? "bg-red-600 hover:bg-red-700" : ""
                    }`}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            </div>

            {/* Email Notifications */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Label>Email Notifications</Label>
                </div>
                <Switch 
                  checked={enableNotifications} 
                  onCheckedChange={setEnableNotifications}
                />
              </div>
              
              {enableNotifications && (
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                />
              )}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!name || !selectedPair}
            className="font-cyber gap-2"
          >
            <Save className="w-4 h-4" />
            Save Strategy
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default AdvancedStrategyPanel;
