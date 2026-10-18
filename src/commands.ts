// handles parsed text 
import { Store } from "@/src/store.js";

// for response part of the map (takes args and curr store as input) 
type Handler = (args: string[], store: Store) => string | Error;

// map for all commands 
// FIXME change all error case to throw error instead later
const handlers = new Map<string, Handler>([
    ["PING", () => "PONG"],
    ["SET", (args, store) => { 
        const [key, value] = args;
        if (!key || !value) { 
            return `ERROR - Invalid Key/key, received ${key} & ${value}`
        }

        store.set(key,value); 
        return "OK";
    }],
    ["GET", (args, store) => { 
        const [key] = args;
        if (!key) { 
            return `ERROR - Invalid Key, received ${key}`
        }

        const value = store.get(key); 
        if (!value) { 
            return `ERROR - Value does not exist, received ${value}`
        }
        return value;
    }],
    ["ECHO", (args) => { 
        // TODO: wrong number of arguments echo "hello world" vs echo hello world
        if (args.length > 1) { 
            return "ERROR" 
        }
        const [value] = args;

        if (!value) { 
            return `ERROR - Invalid Value, received ${value}`
        }

        return `${value}`;
    }
    ]
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