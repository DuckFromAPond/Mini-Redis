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

function isCommandArray(value: unknown): value is (string | null)[] {
    return Array.isArray(value) &&
        value.every((item) => typeof item === "string" || item === null);
}

export function handleMessages(input:string, store: Store): string | Promise<string> { 
    try {
        const parsedMsg = parse(input);

        if (!Array.isArray(parsedMsg)) {
            return serialize(new Error("expected an array"));
        }

        // the parser allows the rest RESP type in array but I don't know what to do with them 
        // most of the input will be entered and parsed as a bulk string even if it is an int or something else anyways
        if (!isCommandArray(parsedMsg)) {
            return serialize(new Error("command arguments must be strings or null"));
        }

        const commandMsg = handleCommands(parsedMsg, store);
        // if the command is a async command (save), then serialize after the aync work is resolved 
        if (commandMsg instanceof Promise) {
            return commandMsg.then(serialize).catch(serializeError);
        }

        return serialize(commandMsg);
    } catch (err){ 
        return serializeError(err);
    }    
}