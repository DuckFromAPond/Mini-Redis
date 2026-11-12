export type Config = {
  maxmemory: number;
  maxmemoryPolicy: string;
  save: string;
  appendonly: string;
};

// configs for redis-benchmark & cli :p 
export const serverConfig:Config = {
  maxmemory: 0,            // 0 = unlimited, will prob have to take mb as input and calc the appropriate keys limit
  maxmemoryPolicy: "noeviction",
  save: "",
  appendonly: "no",
} as const;


export function getConfigValue(name: string, config: Config = serverConfig): string | undefined {
  switch (name.toLowerCase()) {
    case "maxmemory":
      return String(config.maxmemory);
    case "maxmemory-policy":
      return config.maxmemoryPolicy;
    case "save":
      return config.save;
    case "appendonly":
      return config.appendonly;
    default:
      return undefined;
  }
}