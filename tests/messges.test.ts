import { expect, test } from 'vitest'
import { handleMessages } from '@/src/messages.js';
import { Store } from '@/src/store.js';

test('PING command -> parse -> command -> serialize -> PONG', () => { 
    const store = new Store();
    expect(handleMessages("*1\r\n$4\r\nping\r\n", store)).toEqual("$4\r\nPONG\r\n"); 
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