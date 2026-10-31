# Mini-Redis
A small Redis clone written in TypeScript to learn how Redis functions. Documenting the process of making a Redis clone, including its wire protocol (RESP) and how a server turns bytes from a socket into commands and replies, using the Coding Challenges's "Build your Own Redis Server" as a guideline.

## To do

- Handle several commands arriving in one network chunk (pipelining)
- Handle a command split across several chunks
- Return an error reply for unknown commands
- Argument-count errors for `GET` and `SET`
- Inline commands (plain text like `PING`, without the array form)
- Nested arrays in the parser
- Key expiry (`SET key value EX seconds`)
- RESP3 support ( `HELLO 3` handshake and the extra types)
- Change from using shift to pointer
- Rewrite the error message to match real Redis error 