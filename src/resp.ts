// for parse and serialise resp messages to communicate with redis server 

// class for defining simple string  
export class SimpleString {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

// handle val check for given length and data (then parse to number)
export function parseInteger(value : string, desc?:string) : number {
  // check if the value contains a number
  if (!/^-?\d+$/.test(value)) { 
    throw new SyntaxError(`missing ${desc} value`)
  }

  const parsedInt = Number(value)
  // check if number is a safe int 
  if (!Number.isSafeInteger(parsedInt)) { 
    throw new SyntaxError(`invalid ${desc} value`)
  }

  return parsedInt; 
}

export function parse(input: string): string[] | string | number | null | Error {
  const parts = input.split("\r\n");

  // trialing \r\n check for existence
  if (parts[parts.length - 1] !== "") {
    throw new SyntaxError("RESP must end with \\r\\n");
  }

  // for satifying noUncheckedIndexedAccess
  if (parts[0] === undefined) { 
    throw new SyntaxError("invalid input")
  }

  // in case the first part does not define an arr 
  if (!parts[0]?.startsWith("*")) { 
    // first part is the defines datatype 
    const dt = parts[0].slice(0,1);
    const arg = parts[0].slice(1);
    
    switch (dt) { 
      // simple string 
      case '+': 
        return arg;
      // errors
      case '-':
        return new Error(arg); 
      // integers
      case ':':
        return parseInteger(arg, "integer");
      // bulk string 
      case '$': {
        const strLength = parseInteger(arg, "bulk length");
        parts.shift();                                          // TODO might be better to move to a pointer sys for efficiency
        
        if (strLength === -1) { 
          return null
        }

        const msg = parts[0]
        const len = Buffer.byteLength(msg);
        if (len !== strLength) { 
          throw new SyntaxError("mismatch length between passed length and actual")
        }
        return msg;
      }
      default: 
        throw new SyntaxError(`unsupported RESP element type: ${dt}`);
    }
  }

  // array case
  const msg: string[] = [];
  const arrSize = parseInteger(parts[0].slice(1), "array size"); 
  parts.shift();

  if (arrSize === -1) { 
    return null 
  }

  if (arrSize < 0) {
    throw new SyntaxError(`invalid length`)
  }

  for (let i = 0; i < arrSize; i++) { 
    // first part is the defines datatype 
    const dt = parts[0].slice(0,1);
    
    switch (dt) { 
      // TODO NOTE: technically supported but very rare 
      // case '+': 
      // case '-':
      // case ':': 
      // case '*': 
      case '$': {
        const strLength = parseInteger(parts[0].slice(1), "bulk length");
        parts.shift();                                          // TODO might be better to move to a pointer sys for efficiency
        
        if (strLength === -1) { 
          return null
        }

        const len = Buffer.byteLength(parts[0]);
        if (len !== strLength) { 
          throw new SyntaxError("mismatch length between passed length and actual")
        }
        msg.push(parts[0]);
        parts.shift();
        break;
      }
      default: 
        throw new SyntaxError(`unsupported RESP element type: ${dt}`);
    }
  }

  // small check after array loop for trailing \r\n
  if (parts.length !== 1) {
    throw new SyntaxError("unexpected data after the array");
  }

  return msg; 
}

export function serialize(data: string | SimpleString | null | Error ):string { 
  // null case
  if (data === null) { 
    return "$-1\r\n"; 
  }

  if (data instanceof Error) {
    return `-${data.message}\r\n`;
  }

  // simple string 
  if (data instanceof SimpleString) {
    return `+${data.text}\r\n`;
  }

  const len = String(Buffer.byteLength(data));       // for special case like café 
  
  return (`$${len}\r\n${data}\r\n`)
}