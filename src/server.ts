import net from "node:net"
import { Store } from "@/src/store.js";
import { handleMessages } from "@/src/messages.js";

export async function startServer(
    port: number = 6379,
    savePath?: string,
): Promise<net.Server> {
    const store = await Store.load(savePath);

    const server = net.createServer((socket) => { 
        let asyncCommandInFlight = false;
        const handleRequestError = (error: unknown): void => {
            console.error("request error:", error);
            socket.destroy();
        };

        const processChunk = (chunk: Buffer | string): void => {
            try {
                const response = handleMessages(chunk.toString(), store);
                if (response instanceof Promise) {
                    asyncCommandInFlight = true;
                    void response
                        .then((reply) => {
                            socket.write(reply);
                        })
                        .catch(handleRequestError)
                        .finally(() => {
                            asyncCommandInFlight = false;
                            drainQueue();
                        });
                } else {
                    socket.write(response);
                }
            } catch (error) {
                handleRequestError(error);
            }
        };

        const queuedChunks: (Buffer | string)[] = [];

        const drainQueue = (): void => {
            while (!asyncCommandInFlight && queuedChunks.length > 0) {
                const chunk = queuedChunks.shift();
                if (chunk !== undefined) {
                    processChunk(chunk);
                }
            }
        };

        
        socket.on("data", (chunk) =>  { 
            // console.log("received:", JSON.stringify(chunk.toString()));      // for debugging
            if (asyncCommandInFlight || queuedChunks.length > 0) {
                queuedChunks.push(chunk);
            } else {
                processChunk(chunk);
            }
        })

        socket.on("error", (error) => {
            console.error("socket error:", error.message);
        })
        
    })

    
    return new Promise((resolve) => {
        // console.log("SERVER UP")
        server.listen(port, () => resolve(server));   // wait until it's really listening
    });
}