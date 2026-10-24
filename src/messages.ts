import { parse, serialize } from "@/src/resp.js";
import { handleCommands } from "@/src/commands.js";

export function handleMessages(input:string): string | Error{ 
    const parsedMsg = parse(input); 
    return "HELLO :)";
}