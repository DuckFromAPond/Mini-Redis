import net from "node:net"
import { Store } from "@/src/store.js";
import { handleMessages } from "@/src/messages.js";

export function startServer(port: number = 6379): Promise<net.Server> {
    const store = new Store();

    const server = net.createServer((socket) => { 
        // place incoming request into a queue for async handling  
        let responseQueue = Promise.resolve();

        socket.on("data", (chunk) =>  { 
            // console.log("received:", JSON.stringify(chunk.toString()));      // for debugging
            
            // each connection gets its own queue and are handled as it arrives
            responseQueue = responseQueue.then(async () => {
                const response = await handleMessages(chunk.toString(), store);
                socket.write(response);
            }).catch((error: unknown) => {
                console.error("request error:", error);
                socket.destroy();
            });
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