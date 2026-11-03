import { expect, test } from 'vitest'
import { handleCommands } from '@/src/commands.js';
import { Store } from '@/src/store.js';
import { SimpleString } from '@/src/resp.js';

// PING test 
test('PING command', async () => { 
    await expect(handleCommands(['ping'], new Store())).resolves.toEqual(new SimpleString("PONG")); 
})

test('PING command', async () => { 
    await expect(handleCommands(['PING'], new Store())).resolves.toEqual(new SimpleString("PONG")); 
})

// SET & GET test 
test('SET & GET command', async () => {    
    const store = new Store();                   
    await expect(handleCommands(["set", "name", "coffee"], store)).resolves.toEqual(new SimpleString("OK"));  
    await expect(handleCommands(["get", "name"], store)).resolves.toEqual("coffee");
})

test('SET & GET command for simple string in bulk string', async () => {    
    const store = new Store();                   
    await expect(handleCommands(["set", "greeting", "+hello"], store)).resolves.toEqual(new SimpleString("OK"));  
    await expect(handleCommands(["get", "greeting"], store)).resolves.toEqual("+hello");
})

// ECHO test 
test('ECHO command', async () => { 
    await expect(handleCommands(["echo", "Hello World"], new Store())).resolves.toEqual("Hello World");
})

// ERROR test 
test('ECHO rejects extra arguments', async () => { 
    await expect(handleCommands(["echo", "hello", "world"], new Store())).rejects.toThrow("incorrect number of arguments given")
})

test("lpush on a string key throws WRONGTYPE", () => {
    const store = new Store();
    store.set("name", "coffee");
    expect(() => store.lpush("name", ["a"])).toThrow("WRONGTYPE");
});

test("lpush returns the new length", () => {
    const store = new Store();
    expect(store.lpush("list", ["a", "b"])).toBe(2);
    expect(store.lpush("list", ["c"])).toBe(3);
});

test("SAVE command", async () => {
    const firstStore = new Store();
    await expect(handleCommands(["save"], firstStore)).resolves.toEqual(new SimpleString("OK"));
});
