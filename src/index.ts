// for manually starting server
import { startServer } from "@/src/server.js";
import path from "node:path";

const arg  = Number(process.argv[2]) || 6379;
const port = arg === undefined ? 6379 : Number(arg);

const savePath = path.resolve(process.argv[3] ?? "dump.json");

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`invalid port: ${arg}`);
  process.exit(1);
}

process.on("SIGINT", () => process.exit(0));

startServer(port, savePath);