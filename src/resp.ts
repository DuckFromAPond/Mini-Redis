/** Represents a RESP simple string, distinct from a bulk string. */
export class SimpleString {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

type RespValue = string | number | null | Error | RespValue[];
type Cursor = { offset: number };

/** Signals that more input bytes are needed to finish parsing a RESP value. */
export class IncompleteResp extends SyntaxError {}

/**
 * Parses a signed decimal integer and rejects values outside JavaScript's safe integer range.
 *
 * @param value - Text to parse.
 * @param desc - Name used in validation errors.
 * @returns The parsed integer.
 * @throws {SyntaxError} If the text is invalid or the result is not a safe integer.
 */
export function parseInteger(value : string, desc:string = "integer") : number {
  // check if the value is a number
  if (!/^-?\d+$/.test(value)) { 
    throw new SyntaxError(`invalid ${desc} value`)
  }

  const parsedInt = Number(value)
  if (!Number.isSafeInteger(parsedInt)) { 
    throw new SyntaxError(`incorrect ${desc} value`)
  }

  return parsedInt; 
}

// RESP line values end at the next CRLF; bulk-string bodies use their declared byte length instead.
function readLine(input: Buffer, cursor: Cursor) : string { 
  // starting from offset search for the end of the line using "\r\n"
  const end = input.indexOf("\r\n", cursor.offset, "ascii")
  if (end === -1) { 
    throw new IncompleteResp();
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
    throw new IncompleteResp();
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
      if (length < 0) {
        throw new SyntaxError("invalid bulk string length");
      }

      // note: +2 for trailing \r\n 
      if (cursor.offset + length + 2 > input.length) {
        throw new IncompleteResp();
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
        throw new SyntaxError("invalid array length");
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

/**
 * Parses all RESP values in the input buffer.
 *
 * @param input - RESP bytes or their UTF-8 string representation.
 * @returns Parsed RESP values in input order.
 * @throws {IncompleteResp} If the input ends before a value is complete.
 * @throws {SyntaxError} If the input contains malformed or unsupported RESP.
 */
export function parse(input: string | Buffer): RespValue[] {
  // reuse buffer if already exist 
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8"); 
  const cursor: Cursor = { offset: 0 };               

  // for holding list of inputs/commands (one entry per inputs/commands) received from the same chunk
  const values: RespValue[] = []

  // go through entire input and parse it into a list
  while (cursor.offset < buffer.length) {
    values.push(parseValue(buffer, cursor));
  }
  
  return values;
}

// Read decimal digits directly from the buffer to avoid allocating a header string.
function readAsciiInteger(input: Buffer, cursor: Cursor, description: string): number {
  let negative = false;

  // 45 = "-" so remember that it is negative number
  if (input[cursor.offset] === 45) {
    negative = true;
    cursor.offset += 1;
  }

  const digitsStart = cursor.offset;
  let value = 0;
  // loop through input
  while (cursor.offset < input.length) {
    // note: ! tells compiler that the value at offset cannot be undef or null 
    const byte = input[cursor.offset]!;
    // end if no number is found
    if (byte < 48 || byte > 57) {
      break;
    }

    // convert byte to number and adds to prev value
    value = value * 10 + byte - 48;
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new SyntaxError(`incorrect ${description} value`);
    }

    cursor.offset += 1;
  }

  // if no digit at all then throw err 
  if (cursor.offset === digitsStart) {
    throw new SyntaxError(`invalid ${description} value`);
  }

  // requires both \r\n and not just \r or else throw error 
  if (input[cursor.offset] !== 13 || input[cursor.offset + 1] !== 10) {
    if (cursor.offset >= input.length || input[cursor.offset] === 13) {
      throw new IncompleteResp();
    }
    throw new SyntaxError(`invalid ${description} value`);
  }

  cursor.offset += 2;
  const parsed = negative ? -value : value;
  if (!Number.isSafeInteger(parsed)) {
    throw new SyntaxError(`incorrect ${description} value`);
  }

  return parsed;
}

/**
 * Parses consecutive RESP arrays whose elements are bulk strings, the common client command format.
 *
 * @param input - RESP bytes or their UTF-8 string representation.
 * @returns Parsed commands, or `undefined` when the input uses another RESP shape.
 * @throws {IncompleteResp} If the input ends before a command is complete.
 * @throws {SyntaxError} If a command header or bulk string is malformed.
 */
export function parseCommandBatch(input: string | Buffer): (string | null)[][] | undefined {
  // reuse buffer if exist else use a new one
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  if (buffer.length === 0) {
    return undefined;
  }

  const cursor: Cursor = { offset: 0 };
  // for holding list of commands (one entry per command) received from the same chunk
  const commands: (string | null)[][] = [];

  // loop through input 
  while (cursor.offset < buffer.length) {
    // if the first byte is not "*" then don't run this func and let parse handle it instead 
    if (buffer[cursor.offset] !== 42) {
      return undefined;
    }

    cursor.offset += 1;

    // get the arr length by converting the ascii to int (also doubles as the number of time to loop)
    const count = readAsciiInteger(buffer, cursor, "array length");
    if (count === -1) {
      return undefined;
    }
    if (count < 0) {
      throw new SyntaxError("invalid array length");
    }

    const args: (string | null)[] = [];
    // loop through the input and save each arguments into an arr before pushing the full onto commands
    // assumes the rest of the type from here is a bulk string "$"
    for (let i = 0; i < count; i += 1) {
      // the command/args must be bulk string "$" else it breaks and it parse handles it instead
      if (buffer[cursor.offset] !== 36) {
        return undefined;
      }
      cursor.offset += 1;

      // compare length of string
      const length = readAsciiInteger(buffer, cursor, "bulk string length");
      if (length === -1) {
        args.push(null);
        continue;
      }
      if (length < 0) {
        throw new SyntaxError("invalid or incomplete string length");
      }

      // check "\r\n" existence
      const end = cursor.offset + length;
      if (end + 2 > buffer.length) {
        throw new IncompleteResp();
      }
      if (buffer[end] !== 13 || buffer[end + 1] !== 10) {
        throw new SyntaxError("bulk string is missing its trailing CRLF");
      }

      // save arguments
      args.push(buffer.toString("utf8", cursor.offset, end));
      cursor.offset = end + 2;
    }

    // save all parsed arg to the main list 
    commands.push(args);
  }

  return commands;
}

/**
 * Serializes a supported value as RESP2.
 *
 * @param data - Value to encode.
 * @returns RESP2 bytes represented as a string.
 */
export function serialize(data: string | number | SimpleString | null | Error | string[]):string { 
  // null case
  if (data === null) { 
    return "$-1\r\n"; 
  }

  if (data instanceof Error) {
    return `-ERR ${data.message}\r\n`;
  }

  if (Array.isArray(data)) {
    const items = data.map((item) => serialize(item)).join("");
    return `*${data.length}\r\n${items}`;
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