import { expect, test, vi } from 'vitest'
import { handleMessages } from '@/src/messages.js';
import { Store } from '@/src/store.js';

test('PING command -> parse -> command -> serialize -> PONG', async () => { 
    const store = new Store();
    await expect(handleMessages("*1\r\n$4\r\nping\r\n", store)).resolves.toEqual("+PONG\r\n"); 
})

test('GET command -> not found', async () => {
    const store = new Store(); 
    await expect(handleMessages("*2\r\n$3\r\nget\r\n$4\r\nname\r\n", store)).resolves.toEqual("$-1\r\n")
})

test('ECHO hello world -> multiple args -> error', async () => {
    const store = new Store(); 
    await expect(handleMessages("*3\r\n$4\r\necho\r\n$5\r\nhello\r\n$5\r\nworld\r\n", store)).resolves.toEqual("-ERR incorrect number of arguments given\r\n")
})

test('STRING parse -> error', async () => { 
    const store = new Store(); 
    await expect(handleMessages("+OK\r\n", store)).resolves.toEqual("-ERR expected an array\r\n")
})

test('SET & GET command with expiry timer', async () => {    
    const store = new Store();                   
    await expect(handleMessages("*5\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$2\r\nex\r\n$2\r\n10\r\n", store)).resolves.toEqual("+OK\r\n")  
    await expect(handleMessages("*2\r\n$3\r\nget\r\n$8\r\npassword\r\n", store)).resolves.toEqual("$6\r\ncoffee\r\n")

    vi.useFakeTimers()
    vi.advanceTimersByTime(10000);

    await expect(handleMessages("*2\r\n$3\r\nget\r\n$8\r\npassword\r\n", store)).resolves.toEqual("$-1\r\n")
})

test('ERROR SET command', async () => {    
    const store = new Store();                   
    await expect(handleMessages("*5\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$2\r\nex\r\n$2\r\nAB\r\n", store)).resolves.toEqual("-ERR invalid integer value\r\n");
    await expect(handleMessages("*5\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$2\r\nex\r\n$1\r\n0\r\n", store)).resolves.toEqual("-ERR invalid timer value\r\n")
    await expect(handleMessages("*4\r\n$3\r\nset\r\n$8\r\npassword\r\n$6\r\ncoffee\r\n$1\r\n1\r\n", store)).resolves.toEqual("-ERR the command 1 doesn't exist\r\n")
})


test('SET & EXIST command', async () => {    
    const store = new Store();                   
    await expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\norder\r\n$6\r\ncoffee\r\n", store)).resolves.toEqual("+OK\r\n")  
    await expect(handleMessages("*2\r\n$5\r\nexist\r\n$5\r\norder\r\n", store)).resolves.toEqual(":1\r\n")
    await expect(handleMessages("*2\r\n$5\r\nexist\r\n$5\r\nplace\r\n", store)).resolves.toEqual(":0\r\n")

    await expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\ndrink\r\n$3\r\ntea\r\n", store)).resolves.toEqual("+OK\r\n") 
    await expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\nprice\r\n$4\r\n5.99\r\n", store)).resolves.toEqual("+OK\r\n") 

    await expect(handleMessages("*4\r\n$5\r\nexist\r\n$5\r\norder\r\n$5\r\ndrink\r\n$5\r\nprice\r\n", store)).resolves.toEqual(":3\r\n")
        
})

test('SET & DEL command', async () => {    
    const store = new Store();                   
    await expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\norder\r\n$6\r\ncoffee\r\n", store)).resolves.toEqual("+OK\r\n")  
    await expect(handleMessages("*2\r\n$3\r\ndel\r\n$5\r\norder\r\n", store)).resolves.toEqual(":1\r\n")
    await expect(handleMessages("*2\r\n$3\r\ndel\r\n$5\r\nplace\r\n", store)).resolves.toEqual(":0\r\n")

    await expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\ndrink\r\n$3\r\ntea\r\n", store)).resolves.toEqual("+OK\r\n") 
    await expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\nprice\r\n$4\r\n5.99\r\n", store)).resolves.toEqual("+OK\r\n") 

    await expect(handleMessages("*4\r\n$3\r\ndel\r\n$5\r\norder\r\n$5\r\ndrink\r\n$5\r\nprice\r\n", store)).resolves.toEqual(":2\r\n")
        
})


test('INCR & DECR command', async () => {    
    const store = new Store();                   
    await expect(handleMessages("*3\r\n$3\r\nset\r\n$5\r\norder\r\n$6\r\ncoffee\r\n", store)).resolves.toEqual("+OK\r\n")
    await expect(handleMessages("*2\r\n$4\r\nincr\r\n$5\r\norder\r\n", store)).resolves.toEqual("-ERR value is not an integer\r\n");
    await expect(handleMessages("*2\r\n$4\r\ndecr\r\n$5\r\norder\r\n", store)).resolves.toEqual("-ERR value is not an integer\r\n");
    
    await expect(handleMessages("*2\r\n$4\r\nincr\r\n$5\r\ncount\r\n", store)).resolves.toEqual(":1\r\n")
    await expect(handleMessages("*2\r\n$4\r\nincr\r\n$5\r\ncount\r\n", store)).resolves.toEqual(":2\r\n")

    await expect(handleMessages("*2\r\n$4\r\ndecr\r\n$5\r\ncount\r\n", store)).resolves.toEqual(":1\r\n")
    await expect(handleMessages("*2\r\n$4\r\ndecr\r\n$5\r\nprice\r\n", store)).resolves.toEqual(":-1\r\n")
})
