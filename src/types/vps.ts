export interface VPSConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  sshKey?: string;
  type: "custom" | "lovable-free";
  status: "connected" | "disconnected" | "connecting" | "error";
  lastConnected?: string;
  os?: string;
  region?: string;
}

export interface LovableFreeVPS {
  id: string;
  region: string;
  status: "provisioning" | "running" | "stopped" | "error";
  expiresAt: string;
  specs: {
    cpu: string;
    ram: string;
    storage: string;
  };
  connectionInfo?: {
    host: string;
    port: number;
    username: string;
  };
}

export const VPS_REGIONS = [
  { value: "us-east", label: "US East (Virginia)", flag: "🇺🇸" },
  { value: "us-west", label: "US West (Oregon)", flag: "🇺🇸" },
  { value: "eu-west", label: "Europe (Frankfurt)", flag: "🇩🇪" },
  { value: "eu-central", label: "Europe (London)", flag: "🇬🇧" },
  { value: "asia-east", label: "Asia (Singapore)", flag: "🇸🇬" },
  { value: "asia-pacific", label: "Asia (Tokyo)", flag: "🇯🇵" },
] as const;
