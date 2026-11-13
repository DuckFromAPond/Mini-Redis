export type Config = {
  /** Memory limit in bytes; `0` disables the limit. */
  maxmemory: number;
  /** Supported eviction policy: `noeviction` or `sieve`. */
  maxmemoryPolicy: string;
  /** Compatibility value returned by `CONFIG GET`; not runtime-settable. */
  save: string;
  /** Compatibility value returned by `CONFIG GET`; not runtime-settable. */
  appendonly: string;
};

/** Default server configuration. */
export const serverConfig:Config = {
  maxmemory: 0,
  maxmemoryPolicy: "noeviction",
  save: "",
  appendonly: "no",
} as const;

/**
 * Parses a memory limit with an optional binary unit suffix.
 *
 * @param value - Byte count or a value with a `k`, `kb`, `m`, `mb`, `g`, or `gb` suffix.
 * @returns The limit in bytes.
 * @throws {Error} If the value is invalid or exceeds the safe integer range.
 */
export function parseMemoryLimit(value: string): number {
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

/**
 * Reads a supported setting by name.
 *
 * @param name - Configuration parameter name.
 * @param config - Configuration object to read.
 * @returns The setting value, or `undefined` if the name is unknown.
 */
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