// in-memory store

// entry can either be a list or a string 
type Entry = 
| { type: "string"; value: string; expiresAt?: number } 
| { type: "list"; value: string[]; expiresAt?: number };

// 
const saveDir = "@/store"

// store handles data manip 
export class Store { 
    data = new Map<string, Entry>(); 

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

    async save() { 
        // TODO   
    }
}