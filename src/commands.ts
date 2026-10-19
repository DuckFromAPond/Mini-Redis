// handles parsed text 
import { Store } from "@/src/store.js";

// for response part of the map (takes args and curr store as input) 
type Handler = (args: string[], store: Store) => string | Error;

// map for all commands 
const handlers = new Map<string, Handler>([
    ["PING", () => "PONG"],
    ["SET", (args, store) => { 
        const [key, value] = args;
        if (!key || !value) { 
            throw Error("invalid key/value"); 
        }

        store.set(key,value); 
        return "OK";
    }],
    ["GET", (args, store) => { 
        const [key] = args;
        if (!key) { 
            throw Error("invalid key"); 
        }

        const value = store.get(key); 
        if (!value) { 
            throw Error("invalid value"); 
        }
        return value;
    }],
    ["ECHO", (args) => { 
        // wrong number of arguments echo "hello world" vs echo hello world
        if (args.length > 1) { 
            throw Error("incorrect number of arguments given"); 
        }
        const [value] = args;

        if (!value) { 
            throw Error("invalid value"); 
        }

        return `${value}`;
    }
    ]
])

export function handleCommands(command: string[], store: Store): string | Error { 
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