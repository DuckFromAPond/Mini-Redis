// for manually starting server
import { startServer } from "@/src/server.js";
import path from "node:path";

const port = Number(process.argv[2]) || 6379;
const savePath = path.resolve(process.argv[3] ?? "dump.json");
process.on("SIGINT", () => process.exit(0));

startServer(port, savePath);