// in-memory store for get and set 
class Store { 
    data = new Map<string, string>(); 

    set(Key: string, Value: string): void { 
        this.data.set(Key, Value);
    }

    get(Key: string): string | undefined { 
        return this.data.get(Key);
    }
}