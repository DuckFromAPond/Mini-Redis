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

// parse memory given (i.e. 100mb) into bytes
export function parseMemoryLimit(value: string): number {
  // get the unit
  const match = /^(\d+)(b|kb|k|mb|m|gb|g)?$/i.exec(value.trim());
  if (!match) {
    throw new Error("invalid maxmemory value");
  }

  let multiplier: number;
  switch ((match[2] ?? "b").toLowerCase()) {
    case "b":
      multiplier = 1;
      break;
    case "k":
    case "kb":
      multiplier = 1024;
      break;
    case "m":
    case "mb":
      multiplier = 1024 ** 2;
      break;
    case "g":
    case "gb":
      multiplier = 1024 ** 3;
      break;
    default:
      throw new Error("invalid maxmemory unit");
  }

  const bytes = Number(match[1]) * multiplier;
  if (!Number.isSafeInteger(bytes)) {
    throw new Error("maxmemory value is out of range");
  }

  return bytes;
}

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