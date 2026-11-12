// parse returns a list: one entry per RESP value found in the input

import { describe, expect, test } from 'vitest'
import { IncompleteResp, parse, parseCommandBatch } from '@/src/resp.js'

// one value in the input 
describe('one value test with parse', () => { 
    test('array of two bulk strings', () => {
        expect(parse("*2\r\n$4\r\necho\r\n$11\r\nhello world\r\n")).toEqual([["echo", "hello world"]]);         // technically this will be handled by handleCommandBatch now 
    })

    test('null bulk string $-1', () => {
        expect(parse("$-1\r\n")).toEqual([null]);
    })

    test('null array *-1', () => {
        expect(parse("*-1\r\n")).toEqual([null]);
    })

    test('empty array *0', () => {
        expect(parse("*0\r\n")).toEqual([[]]);
    })

    test('array with one bulk string', () => {
        expect(parse("*1\r\n$4\r\nping\r\n")).toEqual([["ping"]]);
    })

    test('array containing a null and a string', () => {
        expect(parse("*2\r\n$-1\r\n$3\r\nfoo\r\n")).toEqual([[null, "foo"]]);
    })

    test('simple string', () => {
        expect(parse("+OK\r\n")).toEqual(["OK"]);
    })

    test('simple string with a space', () => {
        expect(parse("+hello world\r\n")).toEqual(["hello world"]);
    })

    test('error', () => {
        expect(parse("-Error message\r\n")).toEqual([new Error("Error message")]);
    })

    test('empty bulk string', () => {
        expect(parse("$0\r\n\r\n")).toEqual([""]);
    })

    test('positive integer', () => {
        expect(parse(":1000\r\n")).toEqual([1000]);
    })

    test('negative integer', () => {
        expect(parse(":-5\r\n")).toEqual([-5]);
    })

    test('nested array', () => {
        expect(parse("*2\r\n*1\r\n:5\r\n$3\r\nfoo\r\n")).toEqual([[[5], "foo"]]);
    })

    test('bulk string that contains \\r\\n in its data', () => {
        expect(parse("$4\r\na\r\nb\r\n")).toEqual(["a\r\nb"]);
    })

    test('bulk string with multibyte text (length counts bytes)', () => {
        expect(parse("$5\r\ncafé\r\n")).toEqual(["café"]);
    })
}) 

// several values in one chunk (pipelining) 

test('two commands in one chunk', () => {
    expect(parse("*1\r\n$4\r\nPING\r\n*1\r\n$4\r\nPING\r\n")).toEqual([["PING"], ["PING"]]);
})

test('different commands keep their order', () => {
    expect(parse("*2\r\n$4\r\nECHO\r\n$2\r\nhi\r\n*1\r\n$4\r\nPING\r\n")).toEqual([["ECHO", "hi"], ["PING"]]);
})

test('different value types back to back', () => {
    expect(parse("+OK\r\n:5\r\n")).toEqual(["OK", 5]);
})

test('empty input gives an empty list', () => {
    expect(parse("")).toEqual([]);
})

test("command batch fast parser handles pipelined bulk-string arrays", () => {
    expect(parseCommandBatch(
        "*2\r\n$3\r\nSET\r\n$1\r\na\r\n*2\r\n$3\r\nGET\r\n$1\r\na\r\n",
    )).toEqual([["SET", "a"], ["GET", "a"]]);
})

test("command batch fast parser handles null bulk-string arguments", () => {
    expect(parseCommandBatch("*2\r\n$3\r\nGET\r\n$-1\r\n")).toEqual([["GET", null]]);
})

test("command batch fast parser falls back for other RESP shapes", () => {
    expect(parseCommandBatch("+OK\r\n")).toBeUndefined();
    expect(parseCommandBatch("*2\r\n:5\r\n$3\r\nfoo\r\n")).toBeUndefined();
})

// errors 

test('incomplete bulk string throws', () => {
    expect(() => parse("*1\r\n$4\r\nping")).toThrow(IncompleteResp);
})

test('data after a complete value is read as the next value, so junk throws', () => {
    expect(() => parse("*1\r\n$4\r\nping\r\nextra\r\n")).toThrow("unsupported RESP type marker");
})

test('a valid command followed by junk throws for the whole chunk', () => {
    expect(() => parse("*1\r\n$4\r\nPING\r\n?")).toThrow("unsupported RESP type marker");
})