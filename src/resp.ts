// for parse and serialise resp messages to communicate with redis server 

// class for defining simple string  
export class SimpleString {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

type RespValue = string | number | null | Error | RespValue[];
type Cursor = { offset: number };

// handle val check for given length and data (then parse to number)
export function parseInteger(value : string, desc:string = "integer") : number {
  // check if the value is a number
  if (!/^-?\d+$/.test(value)) { 
    throw new SyntaxError(`invalid ${desc} value`)
  }

  const parsedInt = Number(value)
  // check if number is a safe int 
  if (!Number.isSafeInteger(parsedInt)) { 
    throw new SyntaxError(`incorrect ${desc} value`)
  }

  return parsedInt; 
}

// save the line after the marker until its end where length is not given (so not bulk string) and update the offset accordingly
function readLine(input: Buffer, cursor: Cursor) : string { 
  // starting from offset search for the end of the line using "\r\n"
  const end = input.indexOf("\r\n", cursor.offset, "ascii")
  if (end === -1) { 
    throw new SyntaxError("incomplete RESP line")
  }

  // save line from offset to the end as string 
  const line = input.toString("utf8", cursor.offset, end);
  cursor.offset = end + 2;                       // +2 to skip \r\n

  return line;
}

// for handling the parsing of value pointed to by pointer
function parseValue(input:Buffer, cursor: Cursor): RespValue { 
  // get the value at pointer (will mostly be just the marker for datatype)
  const marker = input[cursor.offset]; 
  if (marker === undefined) {
    throw new SyntaxError("incomplete RESP value");
  }
  // move pointer to the next
  cursor.offset += 1;

  switch(marker) { 
    // + 
    case 43: { 
      return readLine(input, cursor);
    }
    // - 
    case 45: { 
      return new Error(readLine(input, cursor)); 
    }
    // : 
    case 58: { 
      return parseInteger(readLine(input, cursor), "integer");
    }
    // $
    case 36: { 
      const length = parseInteger(readLine(input, cursor), "bulk string length");

      if (length === -1) {
        return null; 
      }

      // checking the length of input 
      // note: +2 for trailing \r\n 
      if (length < 0 || cursor.offset + length + 2 > input.length) { 
        throw new SyntaxError("invalid or incomplete bulk string")
      }

      // verify if the \r\n 
      // note: cannot use readLine here since bulkstring can include its own literal \r\n somewhere so better to use the length to verify end instead
      const end = cursor.offset + length; 
      if (input[end] !== 13 || input[end + 1] !== 10) {   // 13 = \r, 10 = \n
        throw new SyntaxError("bulk string is missing its trailing CRLF");
      }
      const value = input.toString("utf8", cursor.offset, end);
      cursor.offset = end + 2;                   // skip the body and its CRLF
      return value;
    } 
    // *  
    case 42: { 
      const length = parseInteger(readLine(input, cursor), "array length")

      if (length === -1) { 
        return null; 
      }

      if (length < 0) {
        throw new SyntaxError("invalid or incomplete array length");
      }

      // recursively parse into an array
      const values: RespValue[] = []
      for (let i = 0; i < length; i += 1) { 
        values.push(parseValue(input, cursor))
      }

      return values;
    }
    default:
      throw new SyntaxError(`unsupported RESP type marker: ${String.fromCharCode(marker)}`,
    );
  }
}

// parser function for processing input into understandable pieces for command handling  
export function parse(input: string | Buffer): RespValue{
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8"); 
  const cursor = { offset: 0};               

  const value = parseValue(buffer, cursor);

  // everything must be consumed, otherwise there's extra data after the value
  if (cursor.offset !== buffer.length) {
    throw new SyntaxError("unexpected data after RESP value");
  }

  return value;
}

// 
export function serialize(data: string | number | SimpleString | null | Error ):string { 
  // null case
  if (data === null) { 
    return "$-1\r\n"; 
  }

  if (data instanceof Error) {
    return `-ERR ${data.message}\r\n`;
  }

  // simple string 
  if (data instanceof SimpleString) {
    return `+${data.text}\r\n`;
  }

  if (typeof data === "number") {
    return `:${data}\r\n`;
  }

  const len = String(Buffer.byteLength(data));       // for special case like café 
  
  return (`$${len}\r\n${data}\r\n`)
}