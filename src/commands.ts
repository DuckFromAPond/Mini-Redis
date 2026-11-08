// handles parsed text 
import { Store } from "@/src/store.js";
import { SimpleString, parseInteger } from "@/src/resp.js";

// commandResult holds all possible return type 
type CommandResult = string | number | SimpleString | null | Error | string[];

// for response part of the map (takes args and curr store as input) 
// note: Promise<commandResult> here for save since that is async (otherwise all other commands are not async)
type Handler = (
  args: (string | null)[],
  store: Store
) => CommandResult | Promise<CommandResult>;

// helper parser for expire timer 
function parseExpiry(optionExp : string, timer : string | null | undefined): number {
    let multiplier: number;
    let relative: boolean;          // relative = decide to use date.now or not in calculation

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

    // val checks 
    if (timer===undefined || timer === null|| parseInteger(timer) <= 0) { 
        throw new SyntaxError("invalid timer value")
    }
    
    // calculate 
    const value = parseInteger(timer) * multiplier; // in millisecond
    return (relative ? Date.now() + value : value)
}


// map for all commands (mostly just checks)
const handlers = new Map<string, Handler>([
    ["PING", (args) =>  {
        if (args.length > 1) {
            throw new Error("incorrect number of arguments given");
        }
        
        if (args.length === 0) {
            return new SimpleString("PONG")
        }

        const [value] = args;

        if (value === undefined || value === null) { 
            throw new Error("invalid value passed into ping"); 
        }

        return value;
    }],

    ["SET", (args, store) => { 
        // wrong number of arguments 
        if (args.length > 4) {
            throw new Error("incorrect number of arguments given");
        }

        const [key, value, optionExp, timer] = args;

        // "" is still valid so cannot use ! here 
        if (key === undefined || value === undefined || key === null || value === null) { 
            throw new Error("invalid key/value"); 
        }

        if (optionExp === undefined || optionExp === null) { 
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

        if (key === undefined || key === null) { 
            throw new Error(`${key} key is invalid`); 
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

        if (value === undefined || value === null) { 
            throw new Error("missing ECHO message"); 
        }

        return value;
    }], 

    ["EXIST", (args, store) => { 
        // nothing passed in
        if (args.length < 1) { 
            throw new Error ("no key passed in")
        }

        // filter through each key, return length of final list
        return args.filter((key) => {
            if (key === undefined || key === null) { 
                throw new Error ("invalid key")
            }

            // if returned true, then saved
            return store.exists(key);
        }).length
    }], 

    ["DEL", (args, store) => { 
        // nothing passed in
        if (args.length < 1) { 
            throw new Error ("no key passed in")
        }

        // filter through each key, return length of final list
        return args.filter((key) => {
            if (key === undefined || key === null) { 
                throw new Error ("invalid key")
            }

            // if returned true, then saved
            return store.delete(key);
        }).length
    }],

    ["INCR", (args, store) => {
        // nothing passed in 
        if (args.length !== 1) { 
            throw new Error ("invalid number of key passed in")
        }

        const [key] = args;
        if (key === undefined || key === null) { 
            throw new Error(`${key} key is invalid`); 
        }

        return store.incr(key)
    }],

    ["DECR", (args, store) => {
        // nothing passed in 
        if (args.length !== 1) { 
            throw new Error ("invalid number of key passed in")
        }

        const [key] = args;
        if (key === undefined || key === null) { 
            throw new Error(`${key} key is invalid`); 
        }

        return store.decr(key)
    }],

    ["LPUSH", (args, store) => {
        // nothing passed in 
        if (args.length < 2) { 
            throw new Error ("invalid number of key passed in")
        }

        const [key, ...argsValues] = args;
        if (key === undefined || key === null) { 
            throw Error("invalid value"); 
        }  

        const values: string[] = [];
        for (const value of argsValues) {
            if (value === undefined || value === null) { 
                throw Error("invalid value"); 
            }  
            values.push(value)
        }

        return store.lpush(key, values)
    }],

    ["LRANGE", (args, store) => {
        // nothing passed in 
        if (args.length !== 3) { 
            throw new Error ("invalid number of arguments passed in")
        }

        const [key, start, stop] = args;
        if (key === undefined || key === null) { 
            throw Error("invalid key value"); 
        }  

        if (start === undefined || start === null) { 
            throw Error("invalid start"); 
        }   

        if (stop === undefined || stop === null) { 
            throw Error("invalid stop value"); 
        }  

        return store.lrange(key, parseInteger(start), parseInteger(stop));
    }],

    ["RPUSH", (args, store) => {
        // nothing passed in 
        if (args.length < 2) { 
            throw new Error ("invalid number of key passed in")
        }

        const [key, ...argsValues] = args;
        if (key === undefined || key === null) { 
            throw Error("invalid value"); 
        }  

        const values: string[] = [];
        for (const value of argsValues) {
            if (value === undefined || value === null) { 
                throw Error("invalid value"); 
            }  
            values.push(value)
        }

        return store.rpush(key, values)
    }],

    ["SAVE", async (args, store) => {
        // no other args should be passed in 
        if (args.length !== 0) {
            throw new Error("incorrect number of arguments given");
        }

        // save the data  
        await store.save();
        return new SimpleString("OK");
    }],
])

export function handleCommands(
  command: (string | null)[],
  store: Store
): CommandResult | Promise<CommandResult> { 
    const [name, ...args] = command;
    const key = name?.toUpperCase()
    
    if (key === undefined || key === null) { 
        throw Error("invalid value"); 
    }   

    // look up in handler 
    const handlerFunc = handlers.get(key)

    if (handlerFunc === undefined) { 
        throw Error("associated function does not exist");  
    }

    // return the value after handlerFunc ran
    return handlerFunc(args, store);
}