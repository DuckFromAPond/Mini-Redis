import { describe, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Sieve } from "@/src/sieve.js";
import { serverConfig } from "@/src/config.js";
import { Store } from "@/src/store.js";

describe("Sieve", () => {
    test("evict returns undefined when there are no keys", () => {
        const sieve = new Sieve();

        expect(sieve.evict()).toBeUndefined();
    });

    test("evicts unvisited keys in oldest-first order", () => {
        const sieve = new Sieve();
        sieve.onInsert("a");
        sieve.onInsert("b");
        sieve.onInsert("c");

        expect(sieve.evict()).toBe("a");
        expect(sieve.evict()).toBe("b");
        expect(sieve.evict()).toBe("c");
        expect(sieve.evict()).toBeUndefined();
    });

    test("gives an accessed key a second chance", () => {
        const sieve = new Sieve();
        sieve.onInsert("a");
        sieve.onInsert("b");
        sieve.onAccess("a");

        expect(sieve.evict()).toBe("b");
        expect(sieve.evict()).toBe("a");
    });

    test("clears visited bits and evicts after a full scan", () => {
        const sieve = new Sieve();
        sieve.onInsert("a");
        sieve.onInsert("b");
        sieve.onAccess("a");
        sieve.onAccess("b");

        expect(sieve.evict()).toBe("a");
        expect(sieve.evict()).toBe("b");
    });

    test("deleting the hand's key advances eviction to the next key", () => {
        const sieve = new Sieve();
        sieve.onInsert("a");
        sieve.onInsert("b");
        sieve.onInsert("c");
        sieve.onDelete("a");

        expect(sieve.evict()).toBe("b");
        expect(sieve.evict()).toBe("c");
        expect(sieve.evict()).toBeUndefined();
    });

    test("deleting a non-hand key removes it from future eviction", () => {
        const sieve = new Sieve();
        sieve.onInsert("a");
        sieve.onInsert("b");
        sieve.onInsert("c");
        sieve.onDelete("b");

        expect(sieve.evict()).toBe("a");
        expect(sieve.evict()).toBe("c");
        expect(sieve.evict()).toBeUndefined();
    });

    test("accessing or deleting an unknown key does not affect eviction", () => {
        const sieve = new Sieve();
        sieve.onInsert("a");
        sieve.onAccess("missing");
        sieve.onDelete("missing");

        expect(sieve.evict()).toBe("a");
        expect(sieve.evict()).toBeUndefined();
    });
});

describe("Store with SIEVE eviction", () => {
    const config = {
        ...serverConfig,
        maxmemory: 104,
        maxmemoryPolicy: "sieve",
    };

    test("evicts an unaccessed key when a write exceeds the memory limit", () => {
        const store = new Store(undefined, config);
        store.set("a", "1");
        store.set("b", "2");

        store.set("c", "3");

        expect(store.get("a")).toBeUndefined();
        expect(store.get("b")).toBe("2");
        expect(store.get("c")).toBe("3");
    });

    test("an accessed key gets a second chance during Store eviction", () => {
        const store = new Store(undefined, config);
        store.set("a", "1");
        store.set("b", "2");
        expect(store.get("a")).toBe("1");

        store.set("c", "3");

        expect(store.get("a")).toBe("1");
        expect(store.get("b")).toBeUndefined();
        expect(store.get("c")).toBe("3");
    });

    test("deleting a key removes it from SIEVE before later eviction", () => {
        const store = new Store(undefined, config);
        store.set("a", "1");
        store.set("b", "2");
        expect(store.delete("a")).toBe(true);
        store.set("c", "3");

        store.set("d", "4");

        expect(store.get("a")).toBeUndefined();
        expect(store.get("b")).toBeUndefined();
        expect(store.get("c")).toBe("3");
        expect(store.get("d")).toBe("4");
    });

    test("tracks existing keys when SIEVE is enabled after writes", () => {
        const runtimeConfig = {
            ...serverConfig,
            maxmemory: 0,
            maxmemoryPolicy: "noeviction",
        };
        const store = new Store(undefined, runtimeConfig);
        store.set("a", "1");
        store.set("b", "2");

        store.setConfigValue("maxmemory-policy", "sieve");
        store.setConfigValue("maxmemory", "104");
        store.set("c", "3");

        expect(store.get("a")).toBeUndefined();
        expect(store.get("b")).toBe("2");
        expect(store.get("c")).toBe("3");
    });
});

describe("Store with noeviction policy", () => {
    test("accounts for keys created before maxmemory is enabled", () => {
        const runtimeConfig = {
            ...serverConfig,
            maxmemory: 0,
            maxmemoryPolicy: "noeviction",
        };
        const store = new Store(undefined, runtimeConfig);
        store.set("a", "1");
        store.set("b", "2");

        store.setConfigValue("maxmemory", "104");

        expect(() => store.set("c", "3")).toThrow(/OOM/);
        store.delete("a");
        expect(() => store.set("c", "3")).not.toThrow();
    });

    test("keeps an over-limit snapshot and rejects writes until keys are deleted", async () => {
        const directory = await mkdtemp(join(tmpdir(), "redis-tiny-snapshot-"));
        const savePath = join(directory, "dump.json");
        const config = { ...serverConfig, maxmemory: 52 };

        try {
            await writeFile(savePath, JSON.stringify([
                ["a", { type: "string", value: "1" }],
                ["b", { type: "string", value: "2" }],
            ]), "utf8");

            const store = await Store.load(savePath, config);

            expect(store.get("a")).toBe("1");
            expect(store.get("b")).toBe("2");
            expect(() => store.set("c", "3")).toThrow(/OOM/);
            expect(store.get("a")).toBe("1");
            expect(store.get("b")).toBe("2");

            store.delete("a");
            store.delete("b");
            expect(() => store.set("c", "3")).not.toThrow();
            expect(store.get("c")).toBe("3");
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
});
