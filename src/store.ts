// in-memory store
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { count } from "node:console";


// entry can either be a list or a string 
type Entry = 
| { type: "string"; value: string; expiresAt?: number } 
| { type: "list"; value: string[]; expiresAt?: number };

// set the default save path to current dir in a json file named "dump.json"
const defaultSavePath = resolve(process.cwd(), "dump.json");

function invalidSnapshotError(savePath: string, detail: string): SyntaxError {
    return new SyntaxError(
        `Cannot load store snapshot "${savePath}": ${detail}. ` +
        "Back up and repair the file, or remove it to start with an empty store, then restart.",
    );
}

// helper function for load to check for validity 
// takes values and if passed validation then value's type is Entry type (instead of being unknown)
function isEntry(value: unknown): value is Entry {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    // initialize entry as record (since entry set as an object anyway)
    const entry = value as Record<string, unknown>;

    // return false if expiry date exist but isn't a number or isn't finite 
    if (entry.expiresAt !== undefined && 
        (typeof entry.expiresAt !== "number" || !Number.isFinite(entry.expiresAt))) {
        return false;
    }

    // pass condition for a string type, return true if value is actually string
    if (entry.type === "string") {
        return typeof entry.value === "string";
    }

    // pass condition for a list type, return true if value is actually list
    if (entry.type === "list") {
        // a list here is valid if it is list of type string 
        return (Array.isArray(entry.value) && entry.value.every((item) => typeof item === "string"));
    }

    return false;
}

// store handles data manip 
export class Store { 
    data = new Map<string, Entry>(); 

    // default constructor to define a readonly savepath using the default 
    constructor(private readonly savePath = defaultSavePath) {}

    // static makes load method belongs to the Store class itself and not each instance itself
    static async load(savePath = defaultSavePath): Promise<Store> {
        let contents: string;
        try {
            // read from file 
            contents = await readFile(savePath, "utf8");
        } catch (error) {
            // if save file doesn't exist/it can't read the file 
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "ENOENT"
            ) {
                // returns a fresh path with the given/default savepath 
                return new Store(savePath);
            }
            
            throw error;
        }

        // parse contents 
        let snapshot: unknown;
        try {
            snapshot = JSON.parse(contents);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw invalidSnapshotError(savePath, `invalid JSON (${error.message})`);
            }
            throw error;
        }

        if (!Array.isArray(snapshot)) {
            throw invalidSnapshotError(savePath, "expected an array of key-entry pairs");
        }

        // make store and load entry into the store
        const store = new Store(savePath);
        for (const [index, item] of snapshot.entries()) {
            if (!Array.isArray(item) || item.length !== 2) {
                throw invalidSnapshotError(savePath, `invalid entry at index ${index}`);
            }

            const [key, entry] = item;
            if (typeof key !== "string" || !isEntry(entry)) {
                throw invalidSnapshotError(savePath, `invalid entry at index ${index}`);
            }

            if (entry.expiresAt === undefined || Date.now() < entry.expiresAt) {
                store.data.set(key, entry);
            }
        }

        return store;
    }

    // helper function for checking expiery bfore getting/returning data
    private getLiveEntry(key: string): Entry | undefined {
        const entry = this.data.get(key);

        // if expire date exist and date over the expiry then delete data and return undef 
        if (entry?.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
            this.data.delete(key);
            return undefined;
        }

        return entry;
    }

    // helper function for incrementing/decrementing value (mostly just validation checks)
    private adjustInteger(key: string, delta: 1 | -1): number {
        const entry = this.getLiveEntry(key);

        // if entry does not exist, make new key with value of 1 or -1
        if (entry === undefined) {
            this.set(key, String(delta));
            return delta;
        }

        // cannot be list type 
        if (entry.type === "list") {
            throw new Error("WRONGTYPE operation against a key holding the wrong kind of value");
        }

        // check for int
        if (!/^-?\d+$/.test(entry.value)) {
            throw new Error("value is not an integer");
        }

        const current = Number(entry.value);
        // check if it is a safe num
        if (!Number.isSafeInteger(current)) {
            throw new Error("value out of range");
        }

        // update number
        const updated = current + delta;
        // check if it is a safe num
        if (!Number.isSafeInteger(updated)) {
            throw new Error("value out of range");
        }

        entry.value = String(updated);
        return updated;
    }

    // helper function for shifting left or right 
    private adjustList(key: string, values: string[], dir: "l" | "r"): number { 
        let entry = this.getLiveEntry(key);

        // init list if entry is undef 
        if (entry === undefined) {
            entry = { type: "list", value: [] };
            this.data.set(key, entry);
        } else if (entry.type === "string") {
            throw new Error("WRONGTYPE operation against a key holding the wrong kind of value");
        }

        // loop through values and push to the head list
        for (const value of values) {
            if (dir === "l") { 
                entry.value.unshift(value);
            }
            else if (dir === "r" ) { 
                entry.value.push(value)
            }
        }

        return entry.value.length;
    }
     
    set(key: string, value: string, expiresAt?: number): void {
        this.data.set(key, {
            type: "string",
            value,
            ...(expiresAt !== undefined ? { expiresAt } : {}),
        });

    }

    get(key: string): string | undefined {
        const entry = this.getLiveEntry(key);

        // return undefined if entry doesn't exist
        if (entry === undefined) {
            return undefined;
        }
        
        // cannot be list 
        if (entry.type === "list") {
            throw new Error("WRONGTYPE operation against a key holding the wrong kind of value");
        }

        return entry.value;
    }

    lpush(key: string, values: string[]): number {
        return this.adjustList(key, values, "l")
    }

    lrange(key: string, start: number, stop: number): string[] {
        const entry = this.getLiveEntry(key);

        if (entry === undefined) {
            return [];                
        }
        if (entry.type !== "list") {
            throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
        }

        const length = entry.value.length;

        // negative indexes count from the tail
        let from = start < 0 ? length + start : start;
        let to = stop < 0 ? length + stop : stop;

        
        if (from < 0) {
            from = 0;
        }
        if (to >= length) {
            to = length - 1;
        }

        // nothing left between them
        if (from > to) return [];

        return entry.value.slice(from, to + 1);   
    }

    rpush(key: string, values: string[]): number {
        return this.adjustList(key, values, "r")
    }

    exists(key: string): boolean {
        return this.getLiveEntry(key) !== undefined;
    }

    delete(key: string): boolean {
        this.getLiveEntry(key);
        return this.data.delete(key);
    }

    incr(key:string) : number { 
        return this.adjustInteger(key, 1);
    }

    decr(key:string) : number { 
        return this.adjustInteger(key, -1);
    }

    async save(): Promise<void> {
        // check each keys before saving 
        for (const key of this.data.keys()) {
            this.getLiveEntry(key);
        }

        // stringify to save as JSON
        const snapshot = JSON.stringify([...this.data.entries()], null, 2);
        const tempPath = `${this.savePath}.${randomUUID()}.tmp`;
        try {
            await writeFile(tempPath, snapshot, "utf8");

            // if saving to a temp file is done without fail then rename the temp path to save path (data is unaffected and old file becomes the temp file)
            await rename(tempPath, this.savePath);
        } finally {
            // clean up temp path 
            await rm(tempPath, { force: true });
        }
    }
}