import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Copy, CheckCircle2, ArrowRight } from "lucide-react";

interface OAuthCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (accessToken: string, refreshToken?: string) => Promise<void>;
}

const REDIRECT_URI = "https://arbitronking.lovable.app/accounts/callback";

const OAuthCodeDialog = ({ open, onOpenChange, onSuccess }: OAuthCodeDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [authUrl, setAuthUrl] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGetAuthUrl = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ctrader-auth", {
        body: { action: "get_auth_url", redirect_uri: REDIRECT_URI },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error("Failed to generate auth URL");
      setAuthUrl(data.auth_url);
      setStep(2);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to get auth URL", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(REDIRECT_URI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenAuth = () => {
    window.open(authUrl, "_blank");
    setStep(3);
  };

  const handleExchangeCode = async () => {
    const trimmedCode = code.trim();
    // Extract code from URL if user pasted full URL
    let authCode = trimmedCode;
    try {
      const url = new URL(trimmedCode);
      const codeParam = url.searchParams.get("code");
      if (codeParam) authCode = codeParam;
    } catch {
      // Not a URL, use as-is
    }

    if (!authCode) {
      toast({ title: "Error", description: "Please enter the authorization code", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ctrader-auth", {
        body: { action: "exchange_code", code: authCode, redirect_uri: REDIRECT_URI },
      });
      if (error) throw error;
      
      const accessToken = data?.access_token || data?.accessToken;
      const refreshToken = data?.refresh_token || data?.refreshToken;
      
      if (!accessToken) throw new Error("No access token returned");

      await onSuccess(accessToken, refreshToken);
      toast({ title: "Success!", description: "cTrader accounts connected successfully" });
      handleClose();
    } catch (err) {
      toast({ title: "Exchange Failed", description: err instanceof Error ? err.message : "Failed to exchange code", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setAuthUrl("");
    setCode("");
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cyber">Connect cTrader</DialogTitle>
          <DialogDescription>
            Authorize this app with your cTrader account
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
              <p className="font-semibold text-amber-400 mb-2">⚠️ One-time setup required</p>
              <p className="text-muted-foreground mb-2">
                Add this <strong>Redirect URI</strong> to your cTrader app in the{" "}
                <a href="https://openapi.ctrader.com/apps" target="_blank" rel="noopener" className="text-primary underline">
                  Spotware Developer Portal
                </a>:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background p-2 rounded border border-border break-all">
                  {REDIRECT_URI}
                </code>
                <Button variant="ghost" size="icon" onClick={handleCopyRedirectUri} className="shrink-0">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={handleGetAuthUrl} disabled={loading} className="w-full font-cyber">
              {loading ? "Generating..." : "I've added it — Continue"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click below to open the cTrader login page. After logging in, you'll be redirected. 
              <strong> Copy the full URL</strong> from your browser's address bar and paste it in the next step.
            </p>
            <Button onClick={handleOpenAuth} className="w-full font-cyber gap-2">
              <ExternalLink className="w-4 h-4" />
              Open cTrader Login
            </Button>
            <Button variant="outline" onClick={() => setStep(3)} className="w-full text-sm">
              I've logged in — Next
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste the <strong>full URL</strong> from your browser after logging in, or just the <code>code=</code> value:
            </p>
            <Input
              placeholder="Paste URL or authorization code here..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono text-xs"
            />
            <Button onClick={handleExchangeCode} disabled={loading || !code.trim()} className="w-full font-cyber">
              {loading ? "Connecting..." : "Connect Account"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OAuthCodeDialog;
