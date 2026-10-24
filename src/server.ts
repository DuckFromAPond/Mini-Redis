import net from "node:net"
import { Store } from "@/src/store.js";

export function startServer(port: number = 6379): Promise<net.Server> {
    const store = new Store();

    const server = net.createServer((socket) => { 
        socket.on("data", (chunk) =>  { 
            // log 
            console.log(chunk.toString())
            socket.write("+PONG\r\n");
        })
        
    })

    
    return new Promise((resolve) => {
        server.listen(port, () => resolve(server));   // wait until it's really listening
    });
}

startServer(); 