// for parse test 

import { expect, test } from 'vitest'
import { parse } from '@/src/resp.js'

// passed 
test('*2\\r\\n$4\\r\\necho\\r\\n$11\\r\\nhello world\\r\\n', () => { 
    expect(parse("*2\r\n$4\r\necho\r\n$11\r\nhello world\r\n")).toEqual(["echo","hello world"]); 
})

// passed 
test('$-1\\r\\n', () => { 
    expect(parse("$-1\r\n")).toEqual(null); 
})

// passed
test('*-1\\r\\n', () => { 
    expect(parse("*-1\r\n")).toEqual(null); 
})

// passed
test('*0\\r\\n', () => { 
    expect(parse("*0\r\n")).toEqual([]); 
})

// passed 
test('*1\\r\\n$4\\r\\nping\\r\\n', () => { 
    expect(parse("*1\r\n$4\r\nping\r\n")).toEqual(["ping"]); 
})

// passed
test('+OK\\r\\n', () => { 
    expect(parse("+OK\r\n")).toEqual("OK"); 
})

// passed
test('-Error message\\r\\n', () => { 
    expect(parse("-Error message\r\n")).toEqual(new Error("Error message")); 
})

// passed
test('$0\\r\\n\\r\\n', () => { 
    expect(parse("$0\r\n\r\n")).toEqual(""); 
})

// passed
test('+hello world\\r\\n', () => { 
    expect(parse("+hello world\r\n")).toEqual("hello world"); 
})

// passed
test(':1000\\r\\n', () => { 
    expect(parse(":1000\r\n")).toEqual(1000); 
})

// passed
test(':-5\\r\\n', () => { 
    expect(parse(":-5\r\n")).toEqual(-5); 
})
