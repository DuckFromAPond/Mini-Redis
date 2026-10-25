import { parse, serialize } from "@/src/resp.js";
import { handleCommands } from "@/src/commands.js";
import { Store } from "@/src/store.js";

export function handleMessages(input:string, store: Store): string { 
    try {
        const parsedMsg = parse(input);

        if (Array.isArray(parsedMsg)){ 
            const commandMsg = handleCommands(parsedMsg, store);

            const serializeMsg = serialize(commandMsg); 

            return serializeMsg;
        }
    } catch (err){ 
        // transforms the throws into the error response 
        if (err instanceof Error) {
            // all transformation unified in the serialize  
            return serialize(err);
        }
        throw err;
    }    

    return serialize(new Error("expected an array"));
}