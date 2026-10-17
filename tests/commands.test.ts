import { expect, test } from 'vitest'
import { handleCommands } from '@/src/commands.js';
import { Store } from '@/src/store.js';

test('PING command', () => { 
    expect(handleCommands(['ping'], new Store())).toEqual("PONG"); 
})

test('PING command', () => { 
    expect(handleCommands(['PING'], new Store())).toEqual("PONG"); 
})
