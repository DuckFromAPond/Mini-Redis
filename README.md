# Mini-Redis
A small Redis clone written in TypeScript to learn how Redis functions. Documenting the process of making a Redis clone, including its wire protocol (RESP) and how a server turns bytes from a socket into commands and replies, using the Coding Challenges's "Build your Own Redis Server" as a guideline.

## To do

- Handle several commands arriving in one network chunk (pipelining)
- Handle a command split across several chunks
- Argument-count errors for `GET` and `SET`
- Inline commands (plain text like `PING`, without the array form)
- Nested arrays in the parser
- RESP3 support ( `HELLO 3` handshake and the extra types)
- Change from using shift to pointer
- Rewrite the error message to match real Redis error 
- REWRITE TODO WITH MORE DETAIL 

`SAVE` writes the current store snapshot as JSON to `dump.json` in the current working directory. The server loads that snapshot when it starts; missing snapshots start with an empty store, while invalid snapshots or other file errors prevent startup. Expired entries are omitted when saving and loading. `startServer` accepts an optional second argument to select a different snapshot path.

Command handling stays synchronous for ordinary commands. `SAVE` is asynchronous, and the server queues later requests from that same connection until the save finishes so replies remain in order.