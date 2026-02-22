import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExternalLink, Key, AlertCircle, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const LS_KEY_ACCESS = "ctrader_manual_access_token";
const LS_KEY_REFRESH = "ctrader_manual_refresh_token";

interface ManualTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (accessToken: string, refreshToken?: string) => Promise<void>;
}

const ManualTokenDialog = ({ open, onOpenChange, onSubmit }: ManualTokenDialogProps) => {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load saved tokens from localStorage on mount
  useEffect(() => {
    const savedAccess = localStorage.getItem(LS_KEY_ACCESS);
    const savedRefresh = localStorage.getItem(LS_KEY_REFRESH);
    if (savedAccess) setAccessToken(savedAccess);
    if (savedRefresh) setRefreshToken(savedRefresh);
  }, []);

  const handleSaveTokens = () => {
    if (accessToken.trim()) localStorage.setItem(LS_KEY_ACCESS, accessToken.trim());
    if (refreshToken.trim()) localStorage.setItem(LS_KEY_REFRESH, refreshToken.trim());
    toast({ title: "Tokens Saved", description: "Tokens saved to local storage for quick access" });
  };

  const handleSubmit = async () => {
    if (!accessToken.trim()) {
      setError("Please enter your access token");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      // Save to localStorage automatically on connect
      if (accessToken.trim()) localStorage.setItem(LS_KEY_ACCESS, accessToken.trim());
      if (refreshToken.trim()) localStorage.setItem(LS_KEY_REFRESH, refreshToken.trim());
      await onSubmit(accessToken.trim(), refreshToken.trim() || undefined);
      // Don't clear fields or close dialog — keep tokens visible
      toast({ title: "Connected!", description: "Account connected. Tokens remain saved." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cyber flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Manual Token Entry
          </DialogTitle>
          <DialogDescription>
            If the automatic OAuth connection doesn't work, you can manually enter your cTrader (Spotware Connect) OAuth access token.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              To get an access token that works here:
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Use the same OAuth access token you receive from the cTrader Connect login flow</li>
                <li>If you generate a token in a different portal/tool, it may not work with these endpoints</li>
                <li>Paste the token below and connect</li>
              </ol>
            </AlertDescription>
          </Alert>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open('https://connect.spotware.com/apps', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open cTrader Developer Portal
          </Button>

          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token *</Label>
            <Textarea
              id="accessToken"
              placeholder="Paste your cTrader access token here..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="min-h-[80px] font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refreshToken">Refresh Token (recommended)</Label>
            <Textarea
              id="refreshToken"
              placeholder="Paste your refresh token here for auto-renewal..."
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              className="min-h-[60px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">Without a refresh token, you'll need to reconnect when the access token expires.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" size="sm" onClick={handleSaveTokens} className="gap-1">
            <Save className="w-3.5 h-3.5" />
            Save Tokens
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Connecting...
                </>
              ) : (
                "Connect Account"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualTokenDialog;
