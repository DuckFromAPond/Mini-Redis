import net from "node:net"

const server = net.createServer((socket) => { 
    socket.on("data", (chunk) =>  { 
        // log 
        console.log(chunk.toString())
    })
})

server.listen(6379); 
