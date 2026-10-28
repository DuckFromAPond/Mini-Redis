import { expect, test, vi } from 'vitest'
import { handleMessages } from '@/src/messages.js';
import { Store } from '@/src/store.js';
import { SimpleString } from '@/src/resp.js';

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
    expect(handleMessages("*3\r\n$4\r\necho\r\n$5\r\nhello\r\n$5\r\nworld\r\n", store)).toEqual("-incorrect number of arguments given\r\n")
})

test('STRING parse -> error', () => { 
    const store = new Store(); 
    expect(handleMessages("+OK\r\n", store)).toEqual("-expected an array\r\n")
})

test('SET & GET command with expiry timer', () => {    
    const store = new Store();                   
    expect(handleMessages("*5\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$2\r\nex\r\n$2\r\n10\r\n", store)).toEqual("+OK\r\n")  
    expect(handleMessages("*2\r\n$3\r\nget\r\n$8\r\npassword\r\n", store)).toEqual("$6\r\ncoffee\r\n")

    vi.useFakeTimers()
    vi.advanceTimersByTime(11000);

    expect(handleMessages("*2\r\n$3\r\nget\r\n$8\r\npassword\r\n", store)).toEqual("$-1\r\n")
})

