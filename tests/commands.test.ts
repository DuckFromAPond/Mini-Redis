import { expect, test } from 'vitest'
import { handleCommands } from '@/src/commands.js';
import { Store } from '@/src/store.js';

// PING test 
test('PING command', () => { 
    expect(handleCommands(['ping'], new Store())).toEqual("+PONG"); 
})

test('PING command', () => { 
    expect(handleCommands(['PING'], new Store())).toEqual("+PONG"); 
})

// SET & GET test 
test('SET & GET command', () => {    
    const store = new Store();                   
    expect(handleCommands(["set", "name", "coffee"], store)).toEqual("+OK");  
    expect(handleCommands(["get", "name"], store)).toEqual("coffee");
})

// ECHO test 
test('ECHO command', () => { 
    expect(handleCommands(["echo", "Hello World"], new Store)).toEqual("Hello World");
})

// ERROR test 
test('ECHO rejects extra arguments', () => { 
    expect(() => handleCommands(["echo", "hello", "world"], new Store)).toThrow("incorrect number of arguments given")
})