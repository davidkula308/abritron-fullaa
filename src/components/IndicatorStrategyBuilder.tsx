import { useState, useEffect } from "react";
import { 
  TrendingUp, Plus, Trash2, AlertTriangle, ChevronDown, 
  Mail, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Strategy, StrategyCondition, IndicatorType, ConditionType,
  INDICATORS, CONDITIONS, TIMEFRAMES_OPTIONS
} from "@/types/strategy";
import { FOREX_PAIRS } from "@/types/bot";

interface IndicatorStrategyBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (strategy: Strategy) => void;
  editingStrategy?: Strategy | null;
}

const IndicatorStrategyBuilder = ({ 
  open, 
  onOpenChange, 
  onSave, 
  editingStrategy 
}: IndicatorStrategyBuilderProps) => {
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<StrategyCondition[]>([]);
  const [action, setAction] = useState<"BUY" | "SELL" | "BOTH">("BOTH");
  const [selectedPair, setSelectedPair] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [indicatorSettings, setIndicatorSettings] = useState<Record<string, Record<string, number | boolean | string>>>({});
  const [openSettings, setOpenSettings] = useState<string | null>(null);

  useEffect(() => {
    if (editingStrategy && editingStrategy.type === "indicator") {
      setName(editingStrategy.name);
      setConditions(editingStrategy.conditions);
      setAction(editingStrategy.action);
      setSelectedPair(editingStrategy.selectedPair || "");
      setSelectedTimeframe(editingStrategy.selectedTimeframe || "");
      setNotificationEmail(editingStrategy.notificationEmail || "");
      setEnableNotifications(!!editingStrategy.notificationEmail);
      setIndicatorSettings(editingStrategy.settings as Record<string, Record<string, number | boolean | string>> || {});
    } else {
      resetForm();
    }
  }, [editingStrategy, open]);

  const resetForm = () => {
    setName("");
    setConditions([]);
    setAction("BOTH");
    setSelectedPair("");
    setSelectedTimeframe("");
    setNotificationEmail("");
    setEnableNotifications(false);
    setIndicatorSettings({});
    setOpenSettings(null);
  };

  const addCondition = () => {
    const newCondition: StrategyCondition = {
      id: crypto.randomUUID(),
      indicator: "RSI",
      condition: "OVERSOLD",
      logicalOperator: conditions.length > 0 ? "AND" : undefined,
    };
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<StrategyCondition>) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const getValidConditionsForIndicator = (indicator: IndicatorType) => {
    return CONDITIONS.filter(c => c.applicableIndicators.includes(indicator));
  };

  const isConditionInvalid = (condition: StrategyCondition) => {
    const indicatorConfig = INDICATORS.find(i => i.type === condition.indicator);
    return indicatorConfig && !indicatorConfig.conditions.includes(condition.condition);
  };

  const handleSave = () => {
    if (!name || conditions.length === 0 || !selectedPair || !selectedTimeframe) return;

    const strategy: Strategy = {
      id: editingStrategy?.id || crypto.randomUUID(),
      name,
      type: "indicator",
      indicatorType: conditions[0]?.indicator,
      conditions,
      settings: indicatorSettings,
      action,
      isActive: false,
      selectedPair,
      selectedTimeframe,
      notificationEmail: enableNotifications ? notificationEmail : undefined,
      createdAt: editingStrategy?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(strategy);
    resetForm();
  };

  const getIndicatorDefaultSettings = (indicator: IndicatorType) => {
    const config = INDICATORS.find(i => i.type === indicator);
    if (!config) return {};
    
    const defaults: Record<string, number | boolean | string> = {};
    config.parameters.forEach(p => {
      defaults[p.key] = p.defaultValue;
    });
    return defaults;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-cyber flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {editingStrategy ? "Edit Strategy" : "Create Strategy"}
          </DialogTitle>
          <DialogDescription>
            Build your trading strategy using technical indicators
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            {/* Strategy Name */}
            <div className="space-y-2">
              <Label>Strategy Name</Label>
              <Input
                placeholder="My RSI Strategy"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Pair & Timeframe */}
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label>Timeframe</Label>
                <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select TF" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEFRAMES_OPTIONS.map((tf) => (
                      <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Conditions</Label>
                <Button variant="ghost" size="sm" onClick={addCondition} className="gap-1 text-xs">
                  <Plus className="w-3 h-3" />
                  Add Condition
                </Button>
              </div>

              {conditions.length === 0 ? (
                <div className="border border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
                  Click "Add Condition" to start building your strategy
                </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <div key={condition.id} className="space-y-2">
                      {index > 0 && (
                        <Select 
                          value={condition.logicalOperator} 
                          onValueChange={(v) => updateCondition(condition.id, { logicalOperator: v as "AND" | "OR" })}
                        >
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      <div className="bg-secondary/50 rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          {isConditionInvalid(condition) && (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <Select 
                            value={condition.indicator}
                            onValueChange={(v) => {
                              const newIndicator = v as IndicatorType;
                              const validConditions = getValidConditionsForIndicator(newIndicator);
                              updateCondition(condition.id, { 
                                indicator: newIndicator,
                                condition: validConditions[0]?.type || condition.condition
                              });
                              // Initialize settings for this indicator
                              if (!indicatorSettings[newIndicator]) {
                                setIndicatorSettings({
                                  ...indicatorSettings,
                                  [newIndicator]: getIndicatorDefaultSettings(newIndicator)
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INDICATORS.map((ind) => (
                                <SelectItem key={ind.type} value={ind.type}>
                                  {ind.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Select 
                            value={condition.condition}
                            onValueChange={(v) => updateCondition(condition.id, { condition: v as ConditionType })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getValidConditionsForIndicator(condition.indicator).map((cond) => (
                                <SelectItem key={cond.type} value={cond.type}>
                                  {cond.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeCondition(condition.id)}
                            className="shrink-0"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>

                        {isConditionInvalid(condition) && (
                          <p className="text-xs text-amber-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            This condition may not work well with {condition.indicator}
                          </p>
                        )}

                        {/* Indicator Settings */}
                        <Collapsible 
                          open={openSettings === condition.id}
                          onOpenChange={(open) => setOpenSettings(open ? condition.id : null)}
                        >
                          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <ChevronDown className={`w-3 h-3 transition-transform ${openSettings === condition.id ? "rotate-180" : ""}`} />
                            Indicator Settings
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2">
                            <div className="space-y-2">
                               {INDICATORS.find(i => i.type === condition.indicator)?.parameters.map((param) => (
                                 <div key={param.key} className="flex items-center justify-between">
                                   <Label className="text-xs">{param.name}</Label>
                                   <Input
                                     type="text"
                                     inputMode="decimal"
                                     className="w-20 h-7 text-xs"
                                     value={indicatorSettings[condition.indicator]?.[param.key]?.toString() ?? param.defaultValue.toString()}
                                     onChange={(e) => {
                                       const val = e.target.value;
                                       setIndicatorSettings({
                                         ...indicatorSettings,
                                         [condition.indicator]: {
                                           ...indicatorSettings[condition.indicator],
                                           [param.key]: val === '' ? '' : (parseFloat(val) || val)
                                         }
                                       });
                                     }}
                                     onBlur={(e) => {
                                       const val = e.target.value;
                                       if (val === '' || isNaN(parseFloat(val))) {
                                         setIndicatorSettings({
                                           ...indicatorSettings,
                                           [condition.indicator]: {
                                             ...indicatorSettings[condition.indicator],
                                             [param.key]: param.defaultValue
                                           }
                                         });
                                       }
                                     }}
                                   />
                                 </div>
                               ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action */}
            <div className="space-y-2">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!name || conditions.length === 0 || !selectedPair || !selectedTimeframe}
            className="font-cyber gap-2"
          >
            <Save className="w-4 h-4" />
            Save Strategy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IndicatorStrategyBuilder;
