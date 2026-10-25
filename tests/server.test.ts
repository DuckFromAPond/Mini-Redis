import { expect, test } from 'vitest'
import net from "node:net"
import { Redis }from "ioredis"
import { startServer } from "@/src/server.js"

test("PING over a real connection", async () => {
    // start server at any free port 
    const server = await startServer(0);              // 0 = "any free port"
    
    // get port number 
    const { port } = server.address() as net.AddressInfo;
    
    // start client connecting to the port
    // NOTE: using RESP2 for now so protocol: 2, disregarding client info since func is not supported yet
    // TODO add to handler so client can store metadata + allow for handshake to RESP3 later date
    const client = new Redis({ port, protocol:2, disableClientInfo: true, enableReadyCheck: false });

    // ioredis parses serialize res
    expect(await client.ping()).toBe("PONG");

    client.disconnect();
    server.close();
});