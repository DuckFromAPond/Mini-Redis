import { startServer } from "@/src/server.js";
import path from "node:path";

const portArg = process.argv[2];
const port = portArg === undefined ? 6379 : Number(portArg);

const savePath = path.resolve(process.argv[3] ?? "dump.json");

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`invalid port: ${portArg}`);
  process.exit(1);
}

startServer(port, savePath);