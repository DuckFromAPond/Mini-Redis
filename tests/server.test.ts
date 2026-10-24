import { expect, test } from 'vitest'
import net from "node:net";
import Redis from "ioredis"
// import { startServer } from "@/src/server.js"

// test("PING over a real connection", async () => {
//   const server = await startServer(0);              // 0 means "any free port"
//   const { port } = server.address() as net.AddressInfo;
//   const client = new Redis(port);

//   expect(await client.ping()).toBe("PONG");

//   await client.quit();
//   server.close();
// });