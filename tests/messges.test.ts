import { expect, test, vi } from 'vitest'
import { handleMessages } from '@/src/messages.js';
import { Store } from '@/src/store.js';
import { IncompleteResp } from '@/src/resp.js';

test('PING command -> parse -> command -> serialize -> PONG', () => { 
    const store = new Store();
    expect(handleMessages("*1\r\n$4\r\nping\r\n", store)).toEqual("+PONG\r\n"); 
})

test('GET command -> not found', () => {
    const store = new Store(); 
    expect(handleMessages("*2\r\n$3\r\nget\r\n$4\r\nname\r\n", store)).toEqual("$-1\r\n")
})

test('ECHO hello world -> multiple args -> error', () => {
    const store = new Store(); 
    expect(handleMessages("*3\r\n$4\r\necho\r\n$5\r\nhello\r\n$5\r\nworld\r\n", store)).toEqual("-ERR incorrect number of arguments given\r\n")
})

test('STRING parse -> error', () => { 
    const store = new Store(); 
    expect(handleMessages("+OK\r\n", store)).toEqual("-ERR expected an array\r\n")
})

test('SET & GET command with expiry timer', () => {    
    const store = new Store();                   
    expect(handleMessages("*5\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$2\r\nex\r\n$2\r\n10\r\n", store)).toEqual("+OK\r\n")  
    expect(handleMessages("*2\r\n$3\r\nget\r\n$8\r\npassword\r\n", store)).toEqual("$6\r\ncoffee\r\n")

    vi.useFakeTimers()
    vi.advanceTimersByTime(10000);

    expect(handleMessages("*2\r\n$3\r\nget\r\n$8\r\npassword\r\n", store)).toEqual("$-1\r\n")
    vi.useRealTimers();
})

test('ERROR SET command', () => {    
    const store = new Store();                   
    expect(handleMessages("*5\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$2\r\nex\r\n$2\r\nAB\r\n", store)).toEqual("-ERR invalid integer value\r\n");
    expect(handleMessages("*5\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$2\r\nex\r\n$1\r\n0\r\n", store)).toEqual("-ERR invalid timer value\r\n")
    expect(handleMessages("*4\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$1\r\n1\r\n", store)).toEqual("-ERR the command 1 doesn't exist\r\n")
})


test('SET & EXIST command', () => {    
    const store = new Store();                   
    expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\norder\r\n$6\r\ncoffee\r\n", store)).toEqual("+OK\r\n")  
    expect(handleMessages("*2\r\n$5\r\nexist\r\n$5\r\norder\r\n", store)).toEqual(":1\r\n")
    expect(handleMessages("*2\r\n$5\r\nexist\r\n$5\r\nplace\r\n", store)).toEqual(":0\r\n")

    expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\ndrink\r\n$3\r\ntea\r\n", store)).toEqual("+OK\r\n") 
    expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\nprice\r\n$4\r\n5.99\r\n", store)).toEqual("+OK\r\n") 

    expect(handleMessages("*4\r\n$5\r\nexist\r\n$5\r\norder\r\n$5\r\ndrink\r\n$5\r\nprice\r\n", store)).toEqual(":3\r\n")
        
})

test('SET & DEL command', () => {    
    const store = new Store();                   
    expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\norder\r\n$6\r\ncoffee\r\n", store)).toEqual("+OK\r\n")  
    expect(handleMessages("*2\r\n$3\r\ndel\r\n$5\r\norder\r\n", store)).toEqual(":1\r\n")
    expect(handleMessages("*2\r\n$3\r\ndel\r\n$5\r\nplace\r\n", store)).toEqual(":0\r\n")

    expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\ndrink\r\n$3\r\ntea\r\n", store)).toEqual("+OK\r\n") 
    expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\nprice\r\n$4\r\n5.99\r\n", store)).toEqual("+OK\r\n") 

    expect(handleMessages("*4\r\n$3\r\ndel\r\n$5\r\norder\r\n$5\r\ndrink\r\n$5\r\nprice\r\n", store)).toEqual(":2\r\n")
        
})


test('INCR & DECR command', () => {    
    const store = new Store();                   
    expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\norder\r\n$6\r\ncoffee\r\n", store)).toEqual("+OK\r\n")
    expect(handleMessages("*2\r\n$4\r\nincr\r\n$5\r\norder\r\n", store)).toEqual("-ERR value is not an integer\r\n");
    expect(handleMessages("*2\r\n$4\r\ndecr\r\n$5\r\norder\r\n", store)).toEqual("-ERR value is not an integer\r\n");
    
    expect(handleMessages("*2\r\n$4\r\nincr\r\n$5\r\ncount\r\n", store)).toEqual(":1\r\n")
    expect(handleMessages("*2\r\n$4\r\nincr\r\n$5\r\ncount\r\n", store)).toEqual(":2\r\n")

    expect(handleMessages("*2\r\n$4\r\ndecr\r\n$5\r\ncount\r\n", store)).toEqual(":1\r\n")
    expect(handleMessages("*2\r\n$4\r\ndecr\r\n$5\r\nprice\r\n", store)).toEqual(":-1\r\n")
})

test("RPUSH then LRANGE with a negative stop", () => {
    const store = new Store();
    expect(handleMessages("*7\r\n$5\r\nrpush\r\n$1\r\nl\r\n$1\r\na\r\n$1\r\nb\r\n$1\r\nc\r\n$1\r\nd\r\n$1\r\ne\r\n", store)).toEqual(":5\r\n");
    expect(handleMessages("*4\r\n$6\r\nlrange\r\n$1\r\nl\r\n$1\r\n1\r\n$2\r\n-2\r\n", store)).toEqual("*3\r\n$1\r\nb\r\n$1\r\nc\r\n$1\r\nd\r\n");
})

test("two PINGs in one chunk -> two replies in order", () => {
    const store = new Store();
    expect(handleMessages("*1\r\n$4\r\nPING\r\n*1\r\n$4\r\nPING\r\n", store)).toEqual("+PONG\r\n+PONG\r\n");
})

test("redis-benchmark CONFIG GET chunk -> two array replies in order", () => {
    const store = new Store();
    expect(handleMessages("*3\r\n$6\r\nCONFIG\r\n$3\r\nGET\r\n$4\r\nsave\r\n*3\r\n$6\r\nCONFIG\r\n$3\r\nGET\r\n$10\r\nappendonly\r\n", store)).toEqual(
        "*2\r\n$4\r\nsave\r\n$0\r\n\r\n" +
        "*2\r\n$10\r\nappendonly\r\n$2\r\nno\r\n",
    );
})

test("CONFIG GET with an unknown parameter -> empty array", () => {
    const store = new Store();
    expect(handleMessages("*3\r\n$6\r\nCONFIG\r\n$3\r\nGET\r\n$9\r\nmaxmemory\r\n", store)).toEqual("*0\r\n");
})

test("1 command across 2 chunks", () => {
    const store = new Store();
    const first = Buffer.from("*2\r\n$4\r\nEC");
    const second = Buffer.from("HO\r\n$3\r\nhey\r\n");

    expect(() => handleMessages(first, store)).toThrow(IncompleteResp);

    expect(handleMessages(Buffer.concat([first, second]), store)).toBe("$3\r\nhey\r\n");
})