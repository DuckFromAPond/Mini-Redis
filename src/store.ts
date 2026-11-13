// in-memory store
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Sieve } from "@/src/sieve.js";
import { serverConfig,type Config, getConfigValue, parseMemoryLimit } from "@/src/config.js";

// entry can either be a list or a string 
type Entry = 
| { type: "string"; value: string; expiresAt?: number } 
| { type: "list"; value: string[]; expiresAt?: number };

// set the default save path to current dir in a json file named "dump.json"
const defaultSavePath = resolve(process.cwd(), "dump.json");


// using a set estimated overhead cost for each key here for other cost not accounted by the size of the entry & key
const ENTRY_OVERHEAD = 50;


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
    private readonly data = new Map<string, Entry>();
    private policy = new Sieve();
    private sieveEnabled: boolean;

    private usedBytes = 0;
    
    // default constructor to define a readonly savepath using the default 
    constructor(
        private readonly savePath = defaultSavePath,
        private readonly config:Config = serverConfig,
    ) {
        this.sieveEnabled = this.isSieveEnabled();
    }

    // helper for determining if sieve is enabled 
    private isSieveEnabled(): boolean {
        return this.config.maxmemory > 0 && this.config.maxmemoryPolicy === "sieve";
    }

    // helper for enabling sieve map and sync data (so that it will only insert into the sieve map when it is enabled) 
    private syncSieve(): void {
        const enabled = this.isSieveEnabled();
        if (enabled === this.sieveEnabled) return;

        this.policy = new Sieve();
        this.sieveEnabled = enabled;
        if (!enabled) return;

        // start inserting into the sieve map
        for (const key of this.data.keys()) {
            if (this.getLiveEntry(key) !== undefined) {
                this.policy.onInsert(key);
            }
        }
    }

    // helper for recalculating used bytes
    private recalculateUsedBytes(): void {
        let total = 0;
        const now = Date.now();

        // go through each entry and key and calculate the total used bytes
        for (const [key, entry] of this.data) {
            if (entry.expiresAt !== undefined && now >= entry.expiresAt) {
                this.data.delete(key);
                continue;
            }
            total += this.sizeOf(key, entry);
        }

        this.usedBytes = total;
    }

    // helper for calculating size of entry 
    private sizeOf(key: string, entry: Entry): number {
        const valueBytes = entry.type === "string" ? Buffer.byteLength(entry.value) 
            : entry.value.reduce((total, item) => total + Buffer.byteLength(item),0);

        return Buffer.byteLength(key) + valueBytes + ENTRY_OVERHEAD;
    }

    // helper function for checking expiery bfore getting/returning data
    private getLiveEntry(key: string): Entry | undefined {
        const entry = this.data.get(key);

        // if expire date exist and date over the expiry then delete data and return undef 
        if (entry?.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
            this.data.delete(key);
            if (this.sieveEnabled) {
                this.policy.onDelete(key);
            }
            if (this.config.maxmemory > 0) {
                this.usedBytes -= this.sizeOf(key, entry);
            }
            return undefined;
        }

        return entry;
    }

    // helper for evicting entry when passed the limit 
    private makeRoom(key: string, nextEntry: Entry): boolean {
        const limit = this.config.maxmemory;
        // maxmemory = 0 means use as much as available 
        if (limit === 0) return true;

        const newSize = this.sizeOf(key, nextEntry);
        // just end early if new entry by itself bigger than limit 
        if (newSize > limit) return false;

        // calculate projected usage
        const projectedUsage = () => {
            const oldEntry = this.data.get(key);
            const oldSize = oldEntry ? this.sizeOf(key, oldEntry) : 0;
            return this.usedBytes - oldSize + newSize;
        };

        // keep evicting until below limit 
        while (projectedUsage() > limit) {
            if (this.config.maxmemoryPolicy !== "sieve") return false;

            // evict remove entry's metadata and key in the sieve map and returns entry's key
            const victimKey = this.policy.evict();
            if (victimKey === undefined) return false;

            // check entry existence before deletion
            const victim = this.data.get(victimKey);
            if (victim === undefined) {
                throw new Error(`SIEVE returned missing Store key: ${victimKey}`);
            }

            // delete entry from store with its returned key
            this.data.delete(victimKey);
            this.usedBytes -= this.sizeOf(victimKey, victim);
        }

        return true;
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
        
        const nextEntry: Entry = {
            type: "string",
            value: String(updated),
            ...(entry.expiresAt !== undefined ? { expiresAt: entry.expiresAt } : {}),
        };

        // cannot make room after loading and trying to set 
        if (!this.makeRoom(key, nextEntry)) {
            throw new Error("OOM command not allowed when used memory exceeds maxmemory");
        }

        const storedEntry = this.data.get(key);
        this.data.set(key, nextEntry);

        if (this.sieveEnabled) {
            if (storedEntry === undefined) {
                this.policy.onInsert(key);
            } else {
                this.policy.onAccess(key);
            }
        }

        if (this.config.maxmemory > 0) {
            const oldSize = storedEntry === undefined ? 0 : this.sizeOf(key, storedEntry);
            this.usedBytes += this.sizeOf(key, nextEntry) - oldSize;
        }

        return updated;
    }

    // helper function for shifting left or right 
    private adjustList(key: string, values: string[], dir: "l" | "r"): number { 
        let entry = this.getLiveEntry(key);

        if (entry?.type === "string") {
            throw new Error("WRONGTYPE operation against a key holding the wrong kind of value");
        }

        const entryValues = entry?.value ?? [];
        // get new values by adding new entry value with existing values
        const nextValues = dir === "l" ? [...values].reverse().concat(entryValues) : entryValues.concat(values);
        
        // make a new Entry object with new values to compare if is within max memory 
        const nextEntry: Entry = {
            type: "list",
            value: nextValues, ...(entry?.expiresAt !== undefined ? { expiresAt: entry.expiresAt } : {}),
        };
        
        if (!this.makeRoom(key, nextEntry)) {
            throw new Error("OOM command not allowed when used memory exceeds maxmemory");
        }

        const storedEntry = this.data.get(key);
        // set new change 
        this.data.set(key, nextEntry);
        if (this.sieveEnabled) {
            if (storedEntry === undefined) {
                this.policy.onInsert(key);
            } else {
                this.policy.onAccess(key);
            }
        }
        if (this.config.maxmemory > 0) {
            const oldSize = storedEntry === undefined ? 0 : this.sizeOf(key, storedEntry);
            this.usedBytes += this.sizeOf(key, nextEntry) - oldSize;
        }

        return nextValues.length;
    }

    // static makes load method belongs to the Store class itself and not each instance itself
    static async load(savePath = defaultSavePath, config = serverConfig): Promise<Store> {
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
                return new Store(savePath, config);
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
        const store = new Store(savePath, config);
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
                if (store.config.maxmemory > 0) {
                    store.usedBytes += store.sizeOf(key, entry);
                }
                if (store.sieveEnabled) {
                    store.policy.onInsert(key);
                }
            }
        }

        return store;
    }
     
    set(key: string, value: string, expiresAt?: number): void {
        // check entry with key in case it is overwriting
        this.getLiveEntry(key);

        // make a new Entry object with new values to compare if is within max memory 
        const nextEntry: Entry = {
            type: "string",
            value,
            ...(expiresAt !== undefined ? { expiresAt } : {}),
        };
        
        if (!this.makeRoom(key, nextEntry)) {
            throw new Error("OOM command not allowed when used memory exceeds maxmemory");
        }

        const storedEntry = this.data.get(key);
        // set new change 
        this.data.set(key, nextEntry);

        //
        if (this.sieveEnabled) {
            if (storedEntry === undefined) {
                this.policy.onInsert(key);
            } else {
                this.policy.onAccess(key);
            }
        }
        if (this.config.maxmemory > 0) {
            const oldSize = storedEntry === undefined ? 0 : this.sizeOf(key, storedEntry);
            this.usedBytes += this.sizeOf(key, nextEntry) - oldSize;
        }
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

        if (this.sieveEnabled) {
            this.policy.onAccess(key);
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
        if (this.sieveEnabled) {
            this.policy.onAccess(key);
        }

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
        const exists = this.getLiveEntry(key) !== undefined;

        if (exists && this.sieveEnabled) {
            this.policy.onAccess(key);
        }

        return exists;
    }

    delete(key: string): boolean {
        const entry = this.getLiveEntry(key);
        if (entry !== undefined && this.config.maxmemory > 0) {
            this.usedBytes -= this.sizeOf(key, entry);
        }
        if (this.sieveEnabled) this.policy.onDelete(key);
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

    getConfigValue(name: string): string | undefined {
        return getConfigValue(name, this.config);
    }

    setConfigValue(name: string, value: string): void {
        switch (name.toLowerCase()) {
            case "maxmemory": {
                const maxmemory = parseMemoryLimit(value);
                // recalculate used bytes when maxmemory is set 
                if (this.config.maxmemory === 0 && maxmemory > 0) {
                    this.recalculateUsedBytes();
                }
                
                this.config.maxmemory = maxmemory;
                this.syncSieve();
                return;
            }
            case "maxmemory-policy": {
                const policy = value.toLowerCase();
                
                if (policy !== "noeviction" && policy !== "sieve") {
                    throw new Error(`unsupported maxmemory policy: ${value}`);
                }

                this.config.maxmemoryPolicy = policy;
                this.syncSieve();
                return;
            }
            default:
                throw new Error(`unsupported CONFIG parameter: ${name}`);
        }
    }
}