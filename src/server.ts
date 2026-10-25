import net from "node:net"
import { Store } from "@/src/store.js";
import { handleMessages } from "@/src/messages.js";

export function startServer(port: number = 6379): Promise<net.Server> {
    const store = new Store();

    const server = net.createServer((socket) => { 
        socket.on("data", (chunk) =>  { 
            // console.log("received:", JSON.stringify(chunk.toString()));
            
            // pass req into the message  
            const response = handleMessages(chunk.toString(), store)

            // write the serialized reply -> redis-cli or the client library turns it into a readable value
            socket.write(response);
        })

        socket.on("error", (error) => {
            console.error("socket error:", error.message);
        })
        
    })

    
    return new Promise((resolve) => {
        server.listen(port, () => resolve(server));   // wait until it's really listening
    });
}