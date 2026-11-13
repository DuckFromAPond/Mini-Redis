import { describe,test, expect } from "vitest"
import { Store } from "@/src/store.js";

// test("keeps an accessed key when evicting", () => {
//     const store = new Store(); 

//     store.set("a", "1");
//     store.set("b", "2");
//     store.get("a"); // mark "a" as accessed
//     store.set("c", "3"); // capacity is exceeded

//     expect(store.get("a")).toBe("1");
//     expect(store.get("b")).toBeUndefined();
//     expect(store.get("c")).toBe("3");
// });