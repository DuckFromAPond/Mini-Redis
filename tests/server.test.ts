import { expect, test, vi } from 'vitest'
import net from "node:net"
import { Redis }from "ioredis"
import { startServer } from "@/src/server.js"

test("PING over a real connection", async () => {
    // start server at any free port 
    const server = await startServer(0);              // 0 = "any free port"
    
    // get port number 
    const { port } = server.address() as net.AddressInfo;
    
    // start client connecting to the port
    // NOTE: using RESP2 for now so protocol: 2, disregarding client info and ready checks since it is not supported yet
    const client = new Redis({ port, protocol:2, disableClientInfo: true, enableReadyCheck: false });

    try {
        // ioredis parses serialize res
        // PING -> PONG
        expect(await client.ping()).toBe("PONG");
        // SET name coffee
        expect(await client.set("name", "coffee")).toBe("OK"); 
        // GET name
        expect(await client.get("name")).toBe("coffee"); 
        // Null test 
        expect(await client.get("nothing")).toBe(null); 
    } finally {
        client.disconnect();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

test("2 clients test", async () => {
    // start server at any free port 
    const server = await startServer(0);              // 0 = "any free port"
    
    // get port number 
    const { port } = server.address() as net.AddressInfo;
    
    // start client connecting to the port
    const client1 = new Redis({ port, protocol:2, disableClientInfo: true, enableReadyCheck: false });
    const client2 = new Redis({ port, protocol:2, disableClientInfo: true, enableReadyCheck: false });

    try { 
        // ioredis parses serialize res
        // client 1 set shared
        expect(await client1.set("shared", "HELLO")).toBe("OK"); 
        // client get shared
        expect(await client2.get("shared")).toBe("HELLO"); 

        expect(await client1.set("shared", "HELLO")).toBe("OK"); 
    } finally {
        client1.disconnect();
        client2.disconnect();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

test("INCR, DECR, expiry SET, EXIST, and DEL over a real connection", async () => {
    const server = await startServer(0);
    const { port } = server.address() as net.AddressInfo;
    const client = new Redis({ port, protocol: 2, disableClientInfo: true, enableReadyCheck: false });

    try {
        expect(await client.incr("counter")).toBe(1);
        expect(await client.incr("counter")).toBe(2);
        expect(await client.decr("counter")).toBe(1);
        expect(await client.get("counter")).toBe("1");

        expect(await client.set("temporary", "value", "PX", 1000)).toBe("OK");
        expect(await client.call("EXIST", "temporary")).toBe(1);

        // wait in real time
        // await new Promise((resolve) => setTimeout(resolve, 1100));

        // use fake timer to wait 
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 1100);

        expect(await client.get("temporary")).toBe(null);
        expect(await client.call("EXIST", "temporary")).toBe(0);

        expect(await client.del("counter")).toBe(1);
        expect(await client.call("EXIST", "counter")).toBe(0);
    } finally {
        client.disconnect();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

test("Testing split command across chunks with client", async () => {
    // start server at any free port 
    const server = await startServer(0);              // 0 = "any free port"
    
    // get port number 
    const { port } = server.address() as net.AddressInfo;
    
    // start client connecting to the port using net.socket so can split command
    const client = net.createConnection({ port });

    try {
        // wait until client connects/fails to connect
        await new Promise<void>((resolve, reject) => {
            client.once("connect", resolve);
            client.once("error", reject);
        });

        let received = "";
        // set up listener to that appends response on new data
        client.on("data", (chunk) => {
            received += chunk.toString();
        });

        client.write("*2\r\n$4\r\nEC");

        // give the server time to receive the first fragment.
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(received).toBe("");

        client.write("HO\r\n$3\r\nhey\r\n");

        await new Promise<void>((resolve, reject) => {
            // check if whole response already here 
            if (received === "$3\r\nhey\r\n") {
                resolve();
                return;
            }

            // wait for more data to arrive then check again
            const onData = () => {
                if (received === "$3\r\nhey\r\n") {
                    client.off("data", onData);
                    resolve();
                }
            };

            client.on("data", onData);
            client.once("error", reject);
        });

        expect(received).toBe("$3\r\nhey\r\n");
    } finally {
        client.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});