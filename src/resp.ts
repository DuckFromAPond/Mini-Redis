// for parse and serialise resp messages to communicate with redis server 

export function parse(input: string): string[] {
  const parts = input.split("\r\n");

  // check if the message is not empty 
  if (parts[0] === undefined) { 
    return []; 
  }

  // in case the first part does not define an arr 
  if (!parts[0]?.startsWith("*")) { 
    
    return []; 
  }

  const arrSize = Number(parts[0].slice(1)); 
  const msg: string[] = [];
  parts.shift();

  for (let i = 0; i < arrSize; i++) { 
    // first part is the defines datatype 
    const dt = parts[0].slice(0,1);
    parts.shift() 
    
    switch (dt) { 
      // simple string 
      // case '+': 
      
      // case '-':
        
      // case ':':

      case '$': 
        msg.push(parts[0]); 
        parts.shift();
      // case '*': 

    }
    
  }

  return msg; 
}
 