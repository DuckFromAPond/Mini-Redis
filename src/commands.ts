// handles parsed text 
import { Store } from "@/src/store.js";

// for response part of the map (takes args and curr store as input) 
type Handler = (args: string[], store: Store) => string | null;

// map for all commands 
const handlers = new Map<string, Handler>([
    ["PING", () => "PONG"],
    
])

export function handleCommands(command: string[], store: Store): string | null { 
    const [name, ...args] = command;
    const key = name?.toUpperCase()
    
    if (key === undefined) { 
        return null;            // FIXME
    }

    // look up in handler 
    const handlerFunc = handlers.get(key)

    if (handlerFunc === undefined) { 
        return null; 
    }

    return handlerFunc(args, store);
}