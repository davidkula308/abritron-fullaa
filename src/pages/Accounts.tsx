import { useState } from "react";
import { Plus, Server, ExternalLink, LogIn, Trash2, Key, RefreshCw, Link } from "lucide-react";
import AccountCard from "@/components/AccountCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTradingAccounts, useCTraderAuth } from "@/hooks/useTradingAccounts";
import AuthDialog from "@/components/AuthDialog";
import ManualTokenDialog from "@/components/ManualTokenDialog";
import OAuthCodeDialog from "@/components/OAuthCodeDialog";
import ConnectMT5Dialog from "@/components/ConnectMT5Dialog";

const Accounts = () => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { accounts, loading: accountsLoading, refetch, refreshBalances, deleteAccount } = useTradingAccounts();
  const { startOAuth, syncAccounts } = useCTraderAuth();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isOAuthCodeDialogOpen, setIsOAuthCodeDialogOpen] = useState(false);
  const [isMT5DialogOpen, setIsMT5DialogOpen] = useState(false);

  const handleConnectCTrader = async () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }

    try {
      setIsConnecting(true);
      await startOAuth();
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to start cTrader connection",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleManualToken = async (accessToken: string, refreshToken?: string) => {
    try {
      await syncAccounts(accessToken, refreshToken);
      await refetch();
      toast({
        title: "Success!",
        description: "cTrader accounts connected successfully",
      });
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await deleteAccount(accountId);
      toast({
        title: "Account Removed",
        description: "Trading account has been unlinked",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove account",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen pb-20 bg-background flex items-center justify-center">
        <div className="animate-spin text-primary text-2xl">⟳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-cyber text-xl font-bold tracking-wider">
              MY <span className="text-primary">ACCOUNTS</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {user ? `${accounts.length} account${accounts.length !== 1 ? "s" : ""} connected` : "Sign in to connect accounts"}
            </p>
          </div>
          {user && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="icon"
                onClick={() => { refreshBalances(); toast({ title: "Refreshing", description: "Fetching latest balances from broker..." }); }}
                title="Refresh Accounts"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline"
                size="icon"
                onClick={() => setIsManualDialogOpen(true)}
                title="Manual Token Entry"
              >
                <Key className="w-4 h-4" />
              </Button>
              <Button 
                onClick={() => setIsOAuthCodeDialogOpen(true)}
                className="font-cyber text-xs gap-2"
              >
                <Link className="w-4 h-4" />
                cTrader
              </Button>
              <Button 
                onClick={() => setIsMT5DialogOpen(true)}
                variant="secondary"
                className="font-cyber text-xs gap-2"
              >
                <Server className="w-4 h-4" />
                MT5
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {!user ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <LogIn className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-cyber text-lg font-semibold mb-2">Sign In Required</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
              Create an account or sign in to connect your cTrader trading accounts
            </p>
            <Button onClick={() => setIsAuthDialogOpen(true)} className="font-cyber">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In / Sign Up
            </Button>
          </div>
        ) : accountsLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin text-primary text-4xl mb-4">⟳</div>
            <p className="text-muted-foreground">Loading accounts...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <Server className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-cyber text-lg font-semibold mb-2">No Accounts Linked</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
              Connect your cTrader or MT5 account to see real-time balance, equity, and trading data
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => setIsOAuthCodeDialogOpen(true)} className="font-cyber">
                <Link className="w-4 h-4 mr-2" />
                Connect cTrader
              </Button>
              <Button onClick={() => setIsMT5DialogOpen(true)} variant="secondary" className="font-cyber">
                <Server className="w-4 h-4 mr-2" />
                Connect MT5
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsManualDialogOpen(true)} 
                className="font-cyber"
              >
                <Key className="w-4 h-4 mr-2" />
                Manual Token Entry
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div key={account.id} className="relative group">
                <AccountCard
                  broker={account.broker_name || 'Unknown Broker'}
                  accountId={account.account_id}
                  balance={account.balance || 0}
                  equity={account.equity || 0}
                  profit={(account.equity || 0) - (account.balance || 0)}
                  type={account.platform.toUpperCase() as "MT4" | "MT5" | "CTRADER"}
                />
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/20 hover:bg-destructive/40 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      <ManualTokenDialog 
        open={isManualDialogOpen} 
        onOpenChange={setIsManualDialogOpen} 
        onSubmit={handleManualToken}
      />
      <OAuthCodeDialog
        open={isOAuthCodeDialogOpen}
        onOpenChange={setIsOAuthCodeDialogOpen}
        onSuccess={async (accessToken, refreshToken) => {
          await syncAccounts(accessToken, refreshToken);
          await refetch();
        }}
      />
      <ConnectMT5Dialog
        open={isMT5DialogOpen}
        onOpenChange={setIsMT5DialogOpen}
        onSuccess={async () => { await refetch(); }}
      />
    </div>
  );
};

export default Accounts;
