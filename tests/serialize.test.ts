import { expect, test } from 'vitest'
import { serialize } from '@/src/resp.js';

test('serialize bulk string "coffee"', () => { 
    expect(serialize("coffee")).toEqual("$6\r\ncoffee\r\n"); 
})

test('serialize null', () => { 
    expect(serialize(null)).toEqual("$-1\r\n"); 
})

