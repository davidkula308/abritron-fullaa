import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCTraderAuth, useTradingAccounts } from "@/hooks/useTradingAccounts";
import { useToast } from "@/hooks/use-toast";

const AccountsCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { exchangeCode, syncAccounts } = useCTraderAuth();
  const { refetch } = useTradingAccounts();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        toast({
          title: "Connection Failed",
          description: error,
          variant: "destructive",
        });
        navigate("/accounts");
        return;
      }

      if (!code) {
        navigate("/accounts");
        return;
      }

      try {
        // Exchange code for tokens
        const tokenData = await exchangeCode(code);
        
        // Sync accounts from cTrader (pass refresh_token too)
        await syncAccounts(tokenData.access_token, tokenData.refresh_token);
        
        // Refresh accounts list
        await refetch();

        toast({
          title: "Success!",
          description: "cTrader accounts connected successfully",
        });
      } catch (err) {
        toast({
          title: "Connection Failed",
          description: err instanceof Error ? err.message : "Failed to connect cTrader account",
          variant: "destructive",
        });
      }

      navigate("/accounts");
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen pb-20 bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-primary text-4xl mb-4">⟳</div>
        <p className="font-cyber text-lg">Connecting your cTrader account...</p>
        <p className="text-sm text-muted-foreground mt-2">Please wait while we sync your data</p>
      </div>
    </div>
  );
};

export default AccountsCallback;
