import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConnectMT5DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

const ConnectMT5Dialog = ({ open, onOpenChange, onSuccess }: ConnectMT5DialogProps) => {
  const { toast } = useToast();
  const [mt5Login, setMt5Login] = useState("");
  const [mt5Password, setMt5Password] = useState("");
  const [brokerHost, setBrokerHost] = useState("");
  const [brokerPort, setBrokerPort] = useState("443");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!mt5Login.trim() || !mt5Password.trim() || !brokerHost.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("mt5-accounts", {
        body: {
          action: "connect",
          mt5_login: mt5Login.trim(),
          mt5_password: mt5Password.trim(),
          broker_host: brokerHost.trim(),
          broker_port: parseInt(brokerPort) || 443,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "MT5 Account Connected!",
        description: `Balance: $${data.balance?.toLocaleString()} | Equity: $${data.equity?.toLocaleString()}`,
      });

      await onSuccess();
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect MT5 account";
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    setMt5Login("");
    setMt5Password("");
    setBrokerHost("");
    setBrokerPort("443");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cyber flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Connect MT5 Account
          </DialogTitle>
          <DialogDescription>
            Enter your MetaTrader 5 account credentials and broker server details to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="mt5Login">MT5 Account Number *</Label>
            <Input
              id="mt5Login"
              placeholder="e.g. 62333850"
              value={mt5Login}
              onChange={(e) => setMt5Login(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mt5Password">Password *</Label>
            <Input
              id="mt5Password"
              type="password"
              placeholder="Your MT5 account password"
              value={mt5Password}
              onChange={(e) => setMt5Password(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brokerHost">Broker Server Host *</Label>
            <Input
              id="brokerHost"
              placeholder="e.g. 78.140.180.198 or broker-server.com"
              value={brokerHost}
              onChange={(e) => setBrokerHost(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Find this in MT5 → File → Open an Account, or your broker's website.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brokerPort">Port</Label>
            <Input
              id="brokerPort"
              placeholder="443"
              value={brokerPort}
              onChange={(e) => setBrokerPort(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleConnect} disabled={isConnecting} className="font-cyber">
            {isConnecting ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Connecting...
              </>
            ) : (
              "Connect Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectMT5Dialog;
