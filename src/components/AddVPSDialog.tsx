import { useState } from "react";
import { Server, Key, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VPSConfig } from "@/types/vps";

interface AddVPSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (config: Omit<VPSConfig, "id" | "status" | "type">) => void;
}

const AddVPSDialog = ({ open, onOpenChange, onSubmit }: AddVPSDialogProps) => {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sshKey, setSshKey] = useState("");
  const [authType, setAuthType] = useState<"password" | "ssh">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !host || !port || !username) return;
    
    setIsSubmitting(true);
    try {
      onSubmit({
        name,
        host,
        port: parseInt(port),
        username,
        password: authType === "password" ? password : undefined,
        sshKey: authType === "ssh" ? sshKey : undefined,
      });
      
      // Reset form
      setName("");
      setHost("");
      setPort("22");
      setUsername("");
      setPassword("");
      setSshKey("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cyber flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Add Custom VPS
          </DialogTitle>
          <DialogDescription>
            Enter your VPS connection details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">VPS Name</Label>
            <Input
              id="name"
              placeholder="My Trading VPS"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="host">Host / IP Address</Label>
              <Input
                id="host"
                placeholder="123.456.789.0"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="root"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <Tabs value={authType} onValueChange={(v) => setAuthType(v as "password" | "ssh")}>
            <TabsList className="w-full">
              <TabsTrigger value="password" className="flex-1">Password</TabsTrigger>
              <TabsTrigger value="ssh" className="flex-1">SSH Key</TabsTrigger>
            </TabsList>
            
            <TabsContent value="password" className="space-y-2 mt-3">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </TabsContent>
            
            <TabsContent value="ssh" className="space-y-2 mt-3">
              <Label htmlFor="sshKey">Private SSH Key</Label>
              <Textarea
                id="sshKey"
                placeholder="-----BEGIN RSA PRIVATE KEY-----"
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                className="font-mono text-xs min-h-[120px]"
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!name || !host || !username || isSubmitting}
            className="font-cyber"
          >
            {isSubmitting ? "Adding..." : "Add VPS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddVPSDialog;
