import { parse, parseCommandBatch, serialize, IncompleteResp } from "@/src/resp.js";
import { handleCommands } from "@/src/commands.js";
import { Store } from "@/src/store.js";

type RespValue = string | number | null | Error | RespValue[];

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

// message = the whole user input (a litle too late to rename for better clarity　ごめんなさい。。。) 
export function handleMessages(input: string | Buffer, store: Store): string | Promise<string> {
    let values: RespValue[]; 
    try { 
        // use a specialized parser for the command-array format produced by Redis clients (since mostly every commands follow the pattern of starting with * with $)
        // parse is now a fallback for unrecognizable commands
        values = parseCommandBatch(input) ?? parse(input);
    } catch (err) { 
        if (err instanceof IncompleteResp) {
            // throw err to be caught in the server file
            throw err;
        }
        return serializeError(err);
    }

    // run through each parsed input 
    const responses = values.map((value) => {
        try { 
            if (!Array.isArray(value)) {
                return serialize(new Error("expected an array"));
            }

            // the parser allows the rest RESP type in array but I don't know what to do with them 
            // most of the input will be entered and parsed as a bulk string even if it is an int or something else anyways
            if (!isCommandArray(value)) {
                return serialize(new Error("command arguments must be strings or null"));
            }

            const result = handleCommands(value, store);
            if (result instanceof Promise) {
                return result.then(serialize).catch(serializeError);
            }

            return serialize(result)
        } catch (err) { 
            return serializeError(err)
        }
    })
    

    // if the command is a async command (save), then serialize after the aync work is resolved 
    if (responses.some((r) => r instanceof Promise)) {
        return Promise.all(responses).then((all) => all.join(""));
    }

    return (responses as string[]).join("");
}