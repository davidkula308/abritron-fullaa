import { useState } from "react";
import { Cloud, MapPin, Check, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VPS_REGIONS } from "@/types/vps";

interface FreeVPSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvision: (region: string) => void;
}

const FreeVPSDialog = ({ open, onOpenChange, onProvision }: FreeVPSDialogProps) => {
  const [selectedRegion, setSelectedRegion] = useState<string>(VPS_REGIONS[0].value);
  const [isProvisioning, setIsProvisioning] = useState(false);

  const handleProvision = () => {
    setIsProvisioning(true);
    onProvision(selectedRegion);
    setTimeout(() => {
      setIsProvisioning(false);
      onOpenChange(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cyber flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Free Lovable VPS
          </DialogTitle>
          <DialogDescription>
            Get a free cloud VPS to run your trading bots 24/7
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Specs */}
          <div className="bg-secondary/50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3">VPS Specifications</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <Cpu className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-sm font-medium">1 vCPU</p>
                <p className="text-xs text-muted-foreground">Shared</p>
              </div>
              <div>
                <MemoryStick className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-sm font-medium">1 GB</p>
                <p className="text-xs text-muted-foreground">RAM</p>
              </div>
              <div>
                <HardDrive className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-sm font-medium">10 GB</p>
                <p className="text-xs text-muted-foreground">SSD</p>
              </div>
            </div>
          </div>

          {/* Region Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Select Region
            </Label>
            <RadioGroup value={selectedRegion} onValueChange={setSelectedRegion}>
              <div className="grid grid-cols-2 gap-2">
                {VPS_REGIONS.map((region) => (
                  <Label
                    key={region.value}
                    htmlFor={region.value}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedRegion === region.value 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value={region.value} id={region.value} className="sr-only" />
                    <span className="text-lg">{region.flag}</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium">{region.label.split("(")[0]}</p>
                      <p className="text-xs text-muted-foreground">
                        {region.label.match(/\((.*?)\)/)?.[1]}
                      </p>
                    </div>
                    {selectedRegion === region.value && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </Label>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Terms */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>✓ Free for 30 days</p>
            <p>✓ Pre-installed trading environment</p>
            <p>✓ Automatic bot deployment</p>
            <p>✓ No credit card required</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleProvision} 
            disabled={isProvisioning}
            className="font-cyber gap-2"
          >
            {isProvisioning ? (
              <>
                <span className="animate-spin">⟳</span>
                Provisioning...
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                Claim Free VPS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FreeVPSDialog;
