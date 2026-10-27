// handles parsed text 
import { Store } from "@/src/store.js";

// for response part of the map (takes args and curr store as input) 
type Handler = (args: string[], store: Store) => string | null | Error;

// map for all commands 
const handlers = new Map<string, Handler>([
    ["PING", () => "+PONG"],            // FIXME small change might revert later 

    ["SET", (args, store) => { 
        const [key, value] = args;
        // "" is still valid so cannot use ! here 
        if (key === undefined || value === undefined) { 
            throw Error("invalid key/value"); 
        }

        store.set(key,value); 
        return "+OK";
    }],

    ["GET", (args, store) => { 
        const [key] = args;
        if (key === undefined) { 
            throw Error("invalid key"); 
        }

        const value = store.get(key); 
        if (value === undefined) { 
            // no value is not an error but null
            return null;
        }
        return value;
    }],

    ["ECHO", (args) => { 
        // wrong number of arguments echo "hello world" vs echo hello world
        if (args.length !== 1) {
            throw new Error("incorrect number of arguments given");
        }
        const [value] = args;

        if (value === undefined) { 
            throw Error("invalid value"); 
        }

        return value;
    }
    ]
])

export function handleCommands(command: string[], store: Store): string | null | Error { 
    const [name, ...args] = command;
    const key = name?.toUpperCase()
    
    if (key === undefined) { 
        throw Error("invalid value"); 
    }

    // look up in handler 
    const handlerFunc = handlers.get(key)

    if (handlerFunc === undefined) { 
        throw Error("associated function does not exist");  
    }

    return handlerFunc(args, store);
}