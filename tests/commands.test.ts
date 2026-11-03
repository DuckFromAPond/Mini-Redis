import { expect, test } from 'vitest'
import { handleCommands } from '@/src/commands.js';
import { Store } from '@/src/store.js';
import { SimpleString } from '@/src/resp.js';
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// PING test 
test('PING command', () => { 
    expect(handleCommands(['ping'], new Store())).toEqual(new SimpleString("PONG")); 
})

test('PING command', () => { 
    expect(handleCommands(['PING'], new Store())).toEqual(new SimpleString("PONG")); 
})

// SET & GET test 
test('SET & GET command', () => {    
    const store = new Store();                   
    expect(handleCommands(["set", "name", "coffee"], store)).toEqual(new SimpleString("OK"));  
    expect(handleCommands(["get", "name"], store)).toEqual("coffee");
})

test('SET & GET command for simple string in bulk string', () => {    
    const store = new Store();                   
    expect(handleCommands(["set", "greeting", "+hello"], store)).toEqual(new SimpleString("OK"));  
    expect(handleCommands(["get", "greeting"], store)).toEqual("+hello");
})

// ECHO test 
test('ECHO command', () => { 
    expect(handleCommands(["echo", "Hello World"], new Store())).toEqual("Hello World");
})

// ERROR test 
test('ECHO rejects extra arguments', () => { 
    expect(() => handleCommands(["echo", "hello", "world"], new Store())).toThrow("incorrect number of arguments given")
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
    const directory = await mkdtemp(join(tmpdir(), "redis-tiny-"));
    const savePath = join(directory, "dump.json");

    try {
        const store = new Store(savePath);
        store.set("name", "coffee");

        await expect(handleCommands(["save"], store)).resolves.toEqual(new SimpleString("OK"));
        await expect(readFile(savePath, "utf8")).resolves.toBe(
            JSON.stringify([...store.data.entries()], null, 2),
        );
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("loading a saved snapshot restores strings and lists", async () => {
    // make dir with "redis-tiny-" prefix stored in the temp dir 
    const directory = await mkdtemp(join(tmpdir(), "redis-tiny-"));
    // make path to dump location using directory 
    const savePath = join(directory, "dump.json");

    try {
        const original = new Store(savePath);
        original.set("name", "coffee");
        original.lpush("queue", ["first", "second"]);
        await original.save();

        const restored = await Store.load(savePath);
        expect(restored.get("name")).toBe("coffee");
        expect(restored.data.get("queue")).toEqual({
            type: "list",
            value: ["second", "first"],
        });
    } finally {
        // clean up dir 
        await rm(directory, { recursive: true, force: true });
    }
});

test("invalid snapshot error explains how to recover", async () => {
    const directory = await mkdtemp(join(tmpdir(), "redis-tiny-"));
    const savePath = join(directory, "dump.json");

    try {
        await writeFile(savePath, "{ invalid json", "utf8");

        await expect(Store.load(savePath)).rejects.toThrow(
            `Cannot load store snapshot "${savePath}": invalid JSON`,
        );
        await expect(Store.load(savePath)).rejects.toThrow(
            "Back up and repair the file, or remove it to start with an empty store, then restart.",
        );
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
