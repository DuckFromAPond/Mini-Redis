// for parse test 

import { expect, test } from 'vitest'
import { parse } from '@/src/resp.js'

// TODO comment later
test('*2\\r\\n$4\\r\\necho\\r\\n$11\\r\\nhello world\\r\\n', () => { 
    expect(parse("*2\r\n$4\r\necho\r\n$11\r\nhello world\r\n")).toEqual(["echo","hello world"]); 
})

test('$-1\\r\\n', () => { 
    expect(parse("$-1\r\n")).toEqual(null); 
})

test('*-1\\r\\n', () => { 
    expect(parse("*-1\r\n")).toEqual(null); 
})

test('*0\\r\\n', () => { 
    expect(parse("*0\r\n")).toEqual([]); 
})

test('*1\\r\\n$4\\r\\nping\\r\\n', () => { 
    expect(parse("*1\r\n$4\r\nping\r\n")).toEqual(["ping"]); 
})

test('+OK\\r\\n', () => { 
    expect(parse("+OK\r\n")).toEqual("OK"); 
})

test('-Error message\\r\\n', () => { 
    expect(parse("-Error message\r\n")).toEqual(new Error("Error message")); 
})

test('$0\\r\\n\\r\\n', () => { 
    expect(parse("$0\r\n\r\n")).toEqual(""); 
})

test('+hello world\\r\\n', () => { 
    expect(parse("+hello world\r\n")).toEqual("hello world"); 
})

test(':1000\\r\\n', () => { 
    expect(parse(":1000\r\n")).toEqual(1000); 
})

test(':-5\\r\\n', () => { 
    expect(parse(":-5\r\n")).toEqual(-5); 
})

test(':-5\\r\\n', () => { 
    expect(parse(":-5\r\n")).toEqual(-5); 
})

test(':-5\\r\\n', () => { 
    expect(parse(":-5\r\n")).toEqual(-5); 
})

test('*1\\r\\n$4\\r\\nping', () => { 
    expect(() => parse("*1\r\n$4\r\nping")).toThrow("RESP must end with \\r\\n"); 
})

test('*1\\r\\n$4\\r\\nping\\r\\nextra\\r\\n', () => { 
    expect(() => parse("*1\r\n$4\r\nping\r\nextra\r\n")).toThrow("unexpected data after the array"); 
})