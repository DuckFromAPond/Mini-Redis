// in-memory store for get and set 
type Entry = 
    | { type: "string"; value: string; expiresAt?: number } 
    | { type: "list"; value: string[]; expiresAt?: number };

export class Store { 
    data = new Map<string, Entry>(); 

    // helper function for checking expiery bfore getting/returning data
    private getLiveEntry(key: string): Entry | undefined {
        const entry = this.data.get(key);

        if (entry?.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
            this.data.delete(key);
            return undefined;
        }

        return entry;
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

        if (entry === undefined) {
            return undefined;
        }
        
        if (entry.type === "list") {
            throw new Error("WRONGTYPE operation against a key holding the wrong kind of value");
        }

        return entry.value;
    }

    lpush(key: string, values: string[]): number {
        let entry = this.getLiveEntry(key);

        if (entry === undefined) {
            entry = { type: "list", value: [] };
            this.data.set(key, entry);
        } else if (entry.type === "string") {
            throw new Error("WRONGTYPE operation against a key holding the wrong kind of value");
        }

        for (const value of values) {
            entry.value.unshift(value);
        }

        return entry.value.length;
    }

    exists(key: string): boolean {
        return this.getLiveEntry(key) !== undefined;
    }

    delete(key: string): boolean {
        this.getLiveEntry(key);
        return this.data.delete(key);
    }

    incr(key:string) : number { 
        const entry = this.getLiveEntry(key); 
        if (entry === undefined) {
            this.set(key, "1");
            return 1;
        }

        if (entry.type === "list") {
            throw new Error("WRONGTYPE operation against a key holding the wrong kind of value");
        }

        if (!/^-?\d+$/.test(entry.value)) { 
            throw new Error("value is not an integer");
        }

        const intValue = Number(entry.value) + 1
        // check if number is a safe int 
        if (!Number.isSafeInteger(intValue)) { 
            throw new Error("value out of range");
        }
        
        entry.value = intValue.toString();
        return intValue;
    }

    decr(key:string) : number { 
        const entry = this.getLiveEntry(key); 
        if (entry === undefined) {
            this.set(key, "-1");
            return -1;
        }

        if (entry.type === "list") {
            throw new Error("WRONGTYPE operation against a key holding the wrong kind of value");
        }

        if (!/^-?\d+$/.test(entry.value)) { 
            throw new Error("value is not an integer");
        }

        const intValue = Number(entry.value) - 1
        // check if number is a safe int 
        if (!Number.isSafeInteger(intValue)) { 
            throw new Error("value out of range");
        }
        
        entry.value = intValue.toString();
        return intValue;
    }
}