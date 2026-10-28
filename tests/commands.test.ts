import { expect, test } from 'vitest'
import { handleCommands } from '@/src/commands.js';
import { Store } from '@/src/store.js';
import { SimpleString } from '@/src/resp.js';

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
    expect(handleCommands(["echo", "Hello World"], new Store)).toEqual("Hello World");
})

// ERROR test 
test('ECHO rejects extra arguments', () => { 
    expect(() => handleCommands(["echo", "hello", "world"], new Store)).toThrow("incorrect number of arguments given")
})