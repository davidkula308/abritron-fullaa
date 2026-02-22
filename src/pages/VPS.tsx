 import { useState, useEffect } from "react";
 import { Server, Plus, Cloud, Key, Wifi, WifiOff, Globe, Trash2, RefreshCw, Zap, Mail, Play, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AuthDialog from "@/components/AuthDialog";
import AddVPSDialog from "@/components/AddVPSDialog";
import FreeeVPSDialog from "@/components/FreeVPSDialog";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Switch } from "@/components/ui/switch";
 import { useNotifications } from "@/hooks/useNotifications";
 import { useVPS } from "@/hooks/useVPS";

const VPS = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isAddVPSDialogOpen, setIsAddVPSDialogOpen] = useState(false);
  const [isFreeVPSDialogOpen, setIsFreeVPSDialogOpen] = useState(false);
  const { vpsConfigs, loading: vpsLoading, saveVPS, updateVPS, deleteVPS } = useVPS();
  const [notificationEmail, setNotificationEmail] = useState("davidkula109@gmail.com");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [backgroundRunning, setBackgroundRunning] = useState(false);
  const { notifyAppClosed } = useNotifications();

  const customVPS = vpsConfigs.filter(v => !v.is_free_vps);
  const freeVPS = vpsConfigs.find(v => v.is_free_vps) || null;

  // Handle page visibility change (app closed/minimized)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && backgroundRunning && notificationsEnabled && notificationEmail && freeVPS?.status === "running") {
        notifyAppClosed(notificationEmail).catch(console.error);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [backgroundRunning, notificationsEnabled, notificationEmail, freeVPS]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (backgroundRunning && notificationsEnabled && notificationEmail && freeVPS?.status === "running") {
        const payload = JSON.stringify({
          email: notificationEmail,
          subject: "ArbitronKing - Running in Background via VPS",
          message: "Your app has been closed. Your trading bots are now running in the background via VPS.",
          type: "app_closed",
        });
        navigator.sendBeacon(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`, payload);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [backgroundRunning, notificationsEnabled, notificationEmail, freeVPS]);

  const handleAddCustomVPS = async (config: Omit<{ name: string; host: string; port: number; username: string }, never>) => {
    try {
      await saveVPS({
        name: (config as any).name,
        type: 'custom',
        host: (config as any).host,
        port: (config as any).port,
        username: (config as any).username,
        status: 'disconnected',
        is_free_vps: false,
        specs: {},
      });
      toast({ title: "VPS Added", description: `${(config as any).name} has been added to your VPS list` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save VPS", variant: "destructive" });
    }
  };

  const handleProvisionFreeVPS = async (region: string) => {
    try {
      const id = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await saveVPS({
        name: 'Free Lovable VPS',
        type: 'free',
        region,
        status: 'provisioning',
        is_free_vps: true,
        expires_at: expiresAt,
        specs: { cpu: '1 vCPU', ram: '1 GB', storage: '10 GB SSD' },
        host: `vps-${id.slice(0, 8)}.lovable.cloud`,
        port: 22,
        username: 'trader',
      });
      toast({ title: "Provisioning VPS", description: "Your free VPS is being set up..." });
      // Simulate provisioning completing
      setTimeout(async () => {
        const created = vpsConfigs.find(v => v.is_free_vps);
        if (created) {
          await updateVPS(created.id, { status: 'running' });
        }
        toast({ title: "VPS Ready!", description: "Your free Lovable VPS is now running" });
      }, 3000);
    } catch (err) {
      toast({ title: "Error", description: "Failed to provision VPS", variant: "destructive" });
    }
  };

  const handleDeleteVPS = async (id: string) => {
    try {
      await deleteVPS(id);
      toast({ title: "VPS Removed", description: "VPS configuration has been deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to remove VPS", variant: "destructive" });
    }
  };

  const handleConnectVPS = async (id: string) => {
    await updateVPS(id, { status: 'connecting' });
    setTimeout(async () => {
      await updateVPS(id, { status: 'connected', last_connected: new Date().toISOString() });
      toast({ title: "Connected", description: "VPS connection established" });
    }, 2000);
  };

  if (!user) {
    return (
      <div className="min-h-screen pb-20 bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 box-glow">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-cyber text-xl font-bold tracking-wider">VPS <span className="text-primary">MANAGEMENT</span></h1>
              <p className="text-xs text-muted-foreground">Keep your bots running 24/7</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-16 text-center">
          <Server className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-cyber text-lg font-semibold mb-2">Sign In Required</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Sign in to manage your VPS connections</p>
          <Button onClick={() => setIsAuthDialogOpen(true)} className="font-cyber">Sign In / Sign Up</Button>
        </div>
        <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 box-glow">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-cyber text-xl font-bold tracking-wider">VPS <span className="text-primary">MANAGEMENT</span></h1>
              <p className="text-xs text-muted-foreground">Keep your bots running 24/7</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => setIsAddVPSDialogOpen(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Free VPS Section */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle className="font-cyber text-lg">Free Lovable VPS</CardTitle>
            </div>
            <CardDescription>Get a free cloud VPS to run your trading bots 24/7</CardDescription>
          </CardHeader>
          <CardContent>
            {!freeVPS ? (
              <div className="text-center py-4">
                <Cloud className="w-12 h-12 mx-auto mb-3 text-primary/60" />
                <p className="text-sm text-muted-foreground mb-4">1 vCPU • 1 GB RAM • 10 GB SSD • 30 days free</p>
                <Button onClick={() => setIsFreeVPSDialogOpen(true)} className="font-cyber gap-2">
                  <Cloud className="w-4 h-4" />
                  Claim Free VPS
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={freeVPS.status === "running" ? "default" : "secondary"}>
                      {freeVPS.status === "provisioning" && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                      {freeVPS.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{freeVPS.region}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {freeVPS.expires_at && (
                      <span className="text-xs text-muted-foreground">Expires: {new Date(freeVPS.expires_at).toLocaleDateString()}</span>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteVPS(freeVPS.id)} className="w-6 h-6 text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {freeVPS.host && (
                  <div className="bg-secondary/50 rounded-lg p-3 font-mono text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Host:</span><span>{freeVPS.host}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Port:</span><span>{freeVPS.port}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">User:</span><span>{freeVPS.username}</span></div>
                  </div>
                )}
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{freeVPS.specs?.cpu}</span><span>•</span>
                  <span>{freeVPS.specs?.ram}</span><span>•</span>
                  <span>{freeVPS.specs?.storage}</span>
                </div>
                {freeVPS.status === "running" && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-primary" />
                        <Label className="text-sm">Run in Background</Label>
                      </div>
                      <Switch checked={backgroundRunning} onCheckedChange={setBackgroundRunning} />
                    </div>
                    {backgroundRunning && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-primary" />
                            <Label className="text-sm">Email Notifications</Label>
                          </div>
                          <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
                        </div>
                        {notificationsEnabled && (
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Notification Email</Label>
                            <Input type="email" value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="your@email.com" className="h-9" />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                          When enabled, your bots will continue running on the VPS when the app is closed. You'll receive an email at {notificationEmail || "your email"}.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom VPS Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-cyber text-sm font-semibold tracking-wider text-muted-foreground">CUSTOM VPS</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsAddVPSDialogOpen(true)} className="gap-1 text-xs">
              <Plus className="w-3 h-3" />Add VPS
            </Button>
          </div>

          {customVPS.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Key className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-4">Add your own VPS for maximum control</p>
                <Button variant="outline" onClick={() => setIsAddVPSDialogOpen(true)} className="font-cyber text-xs">
                  <Plus className="w-4 h-4 mr-2" />Add Custom VPS
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {customVPS.map((vps) => (
                <Card key={vps.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          vps.status === "connected" ? "bg-green-500" :
                          vps.status === "connecting" ? "bg-yellow-500 animate-pulse" :
                          vps.status === "error" ? "bg-red-500" : "bg-gray-500"
                        }`} />
                        <span className="font-medium">{vps.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{vps.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 mb-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3" />
                        <span>{vps.host}:{vps.port}</span>
                      </div>
                      {vps.last_connected && (
                        <p>Last connected: {new Date(vps.last_connected).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {vps.status === "disconnected" && (
                        <Button size="sm" variant="outline" onClick={() => handleConnectVPS(vps.id)} className="flex-1 gap-1">
                          <Wifi className="w-3 h-3" />Connect
                        </Button>
                      )}
                      {vps.status === "connected" && (
                        <Button size="sm" variant="outline" onClick={() => updateVPS(vps.id, { status: 'disconnected' })} className="flex-1 gap-1">
                          <WifiOff className="w-3 h-3" />Disconnect
                        </Button>
                      )}
                      {vps.status === "connecting" && (
                        <Button size="sm" variant="outline" disabled className="flex-1 gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />Connecting...
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteVPS(vps.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      <AddVPSDialog open={isAddVPSDialogOpen} onOpenChange={setIsAddVPSDialogOpen} onSubmit={handleAddCustomVPS} />
      <FreeeVPSDialog open={isFreeVPSDialogOpen} onOpenChange={setIsFreeVPSDialogOpen} onProvision={handleProvisionFreeVPS} />
    </div>
  );
};

export default VPS;
