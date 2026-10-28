// in-memory store for get and set 
type Entry = { value: string; expiresAt: number | undefined };

export class Store { 
    data = new Map<string, Entry>(); 

    set(key: string, value: string, expiresAt?: number): void { 
        this.data.set(key, {value, expiresAt});
    }

    get(key: string): string | undefined { 
        const entryData = this.data.get(key); 

        if (!entryData) { 
            return undefined
        }

        // delete keys if expired 
        if (entryData.expiresAt && Date.now() >= entryData.expiresAt) { 
            this.data.delete(key);
            return undefined 
        }
        
        return entryData?.value
    }
}