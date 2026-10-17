// for parse and serialise resp messages to communicate with redis server 

export function parse(input: string): string[] | string | Number | null | Error {
  const parts = input.split("\r\n");

  // satisfies noUncheckedIndexedAccess - split() always returns at least one part
  if (parts[0] === undefined) { 
    return []; 
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
        return Number(arg);
      // bulk string 
      case '$': 
        const length = Number(arg)
        parts.shift();
        const msg = length === -1 ? null : parts[0]
        return msg;
      default: 
        return null;    // TODO: validation here later 
    }
  }

  

  // array case
  const msg: string[] = [];
  const arrSize = Number(parts[0].slice(1)); 
  parts.shift();

  if (arrSize === -1) { 
    return null 
  }

  for (let i = 0; i < arrSize; i++) { 
    // first part is the defines datatype 
    const dt = parts[0].slice(0,1);
    parts.shift() 
    
    switch (dt) { 
      // NOTE: technically supported but very rare 
      // case '+': 
      // case '-':
      // case ':':
      // case '*': 
      case '$': 
        msg.push(parts[0]); 
        parts.shift();
        break;
      default: 
        msg.push("UNKNOWN");       // default to UNKNOWN for now instead of silently failing
        parts.shift(); 
        break;
    }
    
  }

  return msg; 
}

// TODO come back later
export function serialize(data: string | null):string { 
  if (data === null) { 
    return "$-1\r\n"; 
  }

  const dt = "$"
  const len = String(data.length);    //Buffer.byteLength(data)
  const newline = "\r\n";
  
  return (dt+len+newline+data+newline)
}