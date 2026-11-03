import { parse, serialize } from "@/src/resp.js";
import { handleCommands } from "@/src/commands.js";
import { Store } from "@/src/store.js";

function serializeError(error: unknown): string {
    // transform the throws into the error message 
    if (error instanceof Error) {
        // all transformation unified in the serialize 
        return serialize(error);
    }
    throw error;
}

export function handleMessages(input:string, store: Store): string | Promise<string> { 
    try {
        const parsedMsg = parse(input);

        if (Array.isArray(parsedMsg)){ 
            const commandMsg = handleCommands(parsedMsg, store);
            if (commandMsg instanceof Promise) {
                return commandMsg.then(serialize).catch(serializeError);
            }
            return serialize(commandMsg);
        }
    } catch (err){ 
        return serializeError(err);
    }    

    return serialize(new Error("expected an array"));
}