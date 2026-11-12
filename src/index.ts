// for manually starting server
import { startServer } from "@/src/server.js";
import path from "node:path";

const arg  = Number(process.argv[2]);
const port = arg === undefined ? 6379 : Number(arg);

// preferable to keep it as is and shouldn't rename but 我不知道 it should be fine
const savePath = path.resolve(process.argv[3] ?? "dump.json");

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`invalid port: ${arg}`);
  process.exit(1);
}

startServer(port, savePath);