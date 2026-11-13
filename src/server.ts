import net from "node:net"
import { Store } from "@/src/store.js";
import { handleMessages } from "@/src/messages.js";
import { IncompleteResp } from "@/src/resp.js";
import { serverConfig, type Config } from "@/src/config.js";

/**
 * Starts the Redis-like server and loads its snapshot.
 *
 * @param port - TCP port to listen on. Defaults to `6379`.
 * @param savePath - Optional path to the JSON snapshot. Defaults to `dump.json` in the current working directory.
 * @param config - Server configuration. Defaults to `serverConfig`.
 * @returns A promise that resolves when the server is listening.
 */
export async function startServer(
    port: number = 6379,
    savePath?: string,
    config: Config = serverConfig,
): Promise<net.Server> {
    // load data into store using the savepath
    const store = await Store.load(savePath, config);

    const server = net.createServer((socket) => { 
        // toggle for deciding if an async command is in flight
        let asyncCommandInFlight = false;

        // log error and close connection
        const handleRequestError = (error: unknown): void => {
            console.error("request error:", error);
            socket.destroy();
        };

        // initialize empty pending buffer for holding onto partial chunk (if any)
        let pending = Buffer.alloc(0);

        const processChunk = (chunk: Buffer | string): void => {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            pending = Buffer.concat([pending, bytes]);

            let response: string | Promise<string>;

            try {
                // handle message (parse input -> command -> serialized response)
                response = handleMessages(pending, store);
                        
            } catch (error) {
                if (error instanceof IncompleteResp) {
                    // move to next chunk 
                    return; 
                }

                // clear pending 
                pending = Buffer.alloc(0);
                handleRequestError(error);

                // exits after error 
                return;
            }

            // clear pending
            pending = Buffer.alloc(0);
                
            // if response is a promise, set async command as being in flight and resolve the promise 
            if (response instanceof Promise) {
                // mostly happens for when a save is called
                asyncCommandInFlight = true;
                void response
                    // let promise resolve before continuing 
                    .then((reply) => socket.write(reply))
                    .catch(handleRequestError)
                    .finally(() => {
                        // reset the toggle
                        asyncCommandInFlight = false;
                        // move to next data in queue
                        drainQueue();
                    });
            } else {
                // normal none-promise response 
                socket.write(response);
            }
        };

        // queue of data
        const queuedChunks: (Buffer | string)[] = [];

        // continue to the next chunk
        const drainQueue = (): void => {
            // if not currently handling an async command and has chunks left, then move to the next chunk and process it
            while (!asyncCommandInFlight && queuedChunks.length > 0) {
                const chunk = queuedChunks.shift();
                if (chunk !== undefined) {
                    // pass it to be processed
                    processChunk(chunk);
                }
            }
        };

        socket.on("data", (chunk) =>  { 
            // console.log("received:", JSON.stringify(chunk.toString()));      // for debugging

            if (asyncCommandInFlight || queuedChunks.length > 0) {
                // Preserve request order while an asynchronous command is running.
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
        server.listen(port, () => resolve(server)); 
    });
}