import { expect, test } from 'vitest'
import { parse } from '@/src/resp.js'

test('*2\\r\\n$4\\r\\necho\\r\\n$11\\r\\nhello world\\r\\n', () => { 
    expect(parse("*2\r\n$4\r\necho\r\n$11\r\nhello world\r\n")).toEqual(["echo","hello world"]); 
})

test('$-1\r\n', () => { 
    expect(parse("$-1\r\n")).toEqual(''); 
})

test('*1\r\n$4\r\nping\r\n', () => { 
    expect(parse("*1\r\n$4\r\nping\r\n")).toEqual(["ping"]); 
})

test('+OK\r\n', () => { 
    expect(parse("+OK\r\n")).toEqual("Ok"); 
})

test('-Error message\r\n', () => { 
    expect(parse("-Error message\r\n")).toEqual("Error message"); 
})

test('$0\r\n\r\n', () => { 
    expect(parse("$0\r\n\r\n")).toEqual("0"); 
})

test('+hello world\r\n', () => { 
    expect(parse("+hello world\r\n")).toEqual("hello world"); 
})
