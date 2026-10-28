// handles parsed text 
import { Store } from "@/src/store.js";
import { SimpleString,parseInteger } from "@/src/resp.js";

// for response part of the map (takes args and curr store as input) 
type Handler = (args: string[], store: Store) => string | SimpleString | null | Error;

// helper parser for expire timer 
function parseExpiry(optionExp : string, timer : string | undefined): number {
    let multiplier: number;
    let relative: boolean; 

    switch (optionExp){
        case "EX":
            // 1 sec = 1000 millisecond
            multiplier = 1000; 
            relative = true;
            break;
        case "PX":
            // 1 millisecond
            multiplier = 1;
            relative = true;
            break;
        case "EXAT":
            multiplier = 1000; 
            relative = false;
            break;
        case "PXAT":
            multiplier = 1; 
            relative = false;
            break;
        default: 
            throw new SyntaxError(`the command ${optionExp} doesn't exist`)
    }

    if (timer===undefined) { 
        throw new SyntaxError("missing timer value")
    }
    
    const value = parseInteger(timer) * multiplier; // in millisecond
    return (relative ? Date.now() + value : value)
}


// map for all commands 
const handlers = new Map<string, Handler>([
    ["PING", () =>  new SimpleString("PONG")],

    ["SET", (args, store) => { 
        // wrong number of arguments 
        if (args.length > 4) {
            throw new Error("incorrect number of arguments given");
        }

        const [key, value, optionExp, timer] = args;

        // "" is still valid so cannot use ! here 
        if (key === undefined || value === undefined) { 
            throw new Error("invalid key/value"); 
        }

        if (optionExp === undefined) { 
            store.set(key, value);
        } else {
            const expireAt = parseExpiry(optionExp?.toUpperCase(), timer); 
            store.set(key,value,expireAt); 
        }

        return new SimpleString("OK"); 
    }],

    ["GET", (args, store) => { 
        // wrong number of arguments
        if (args.length !== 1) {
            throw new Error("incorrect number of arguments given");
        }

        const [key] = args;
        if (key === undefined) { 
            throw new Error(`${key} key doesn't exist`); 
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
            throw new Error("missing ECHO message"); 
        }

        return value;
    }
    ]
])

export function handleCommands(command: string[], store: Store): string | SimpleString | null | Error { 
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