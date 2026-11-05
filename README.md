# Mini-Redis

A small Redis clone written in TypeScript, built to learn how Redis works: its wire protocol (RESP) and how a server turns bytes from a socket into commands and replies. It follows the Coding Challenges "Build Your Own Redis Server" challenge and Redis's documentation.

## Command list

| Command | Description                      | Example              |
| ------- | -------------------------------- | -------------------- |
| PING    | Check the connection             | `PING`               |
| ECHO    | Return the given message         | `ECHO hello`         |
| SET     | Store a value                    | `SET drink coffee`   |
| GET     | Read a value                     | `GET drink`          |
| EXISTS  | Check whether a key is present   | `EXISTS drink`       |
| DEL     | Delete one or more keys          | `DEL drink`          |
| INCR    | Add one to a stored integer      | `INCR counter`       |
| DECR    | Subtract one from a stored integer | `DECR counter`     |
| SAVE    | Write a snapshot to disk         | `SAVE`               |

Commands behave *similarly* to their Redis counterparts, as described in Redis's documentation.

## Design details

Requests move through four layers:

```
client -> TCP (node:net) -> handleMessages -> parse -> command handler -> store -> serialize -> client
```

- **Protocol layer:** `parse` turns RESP bytes into values and `serialize` turns replies back into RESP. The parser reads a `Buffer` with a shared cursor, and bulk strings are read by their declared byte length, so values containing `\r\n` or multibyte characters parse correctly.
- **Command layer:** handlers live in a lookup map keyed by case-insensitive command name. A handler throws an `Error` for bad input.
- **Error handling:** `handleMessages` wraps everything in a try/catch and turns any thrown error into an `-ERR ...` reply, so one bad command never crashes the server.
- **Store:** a wrapper around a `Map`. Expired entries are checked through `getLiveEntry` before they're returned or saved.
- **Replies in order:** `SAVE` is async, so the server queues later requests from that connection until the save finishes.

## Save details

SAVE writes the current store snapshot as JSON to dump.json in the current working directory. The server loads that snapshot when it starts; missing snapshots start with an empty store, while invalid snapshots or other file errors prevent startup. For an invalid snapshot, the startup error includes the file path and recovery guidance: back up and repair the file, or remove it to start with an empty store, then restart. Expired entries are omitted when saving and loading. startServer accepts an optional second argument to select a different snapshot path.

Command handling stays synchronous for ordinary commands. SAVE is asynchronous, and the server queues later requests from that same connection until the save finishes so replies remain in order.

NOTE: It is noticed that making the normal commands asynchronous with SAVE causes significant overhead on performance as found through Redis benchmark compared to when it is not async. This is most likely due to a combination of old commands already being lightweight and new scheduling cost for each request.

## Performance

Measured with `redis-benchmark -t set,get -n 100000 -q` against the local server:

| Version                  | SET (req/s) | GET (req/s) | p50 (ms)        |
| ------------------------ | ----------- | ----------- | --------------- |
| Before async changes     |             |             |                 |
| After async changes      | 55,772      | 64,062      | 0.823 / 0.783   |
| Partial async + Pointer  |             |             |                 |
| Real Redis (same machine)|             |             |                 |

The `WARNING: Could not fetch server CONFIG` line is expected: the benchmark tool asks for server settings through `CONFIG`, which isn't implemented here. It doesn't affect the results.

Making ordinary commands async to support `SAVE` lowered throughput. The likely cause is that these commands were already cheap, so the added scheduling per request became a large share of the cost. (Not yet profiled.)

## Future improvements

- Handle several commands arriving in one network chunk (pipelining) + add support for adding client info
- OPTIMIZE PERFORMANCE 
- Handle a command split across several chunks
- Argument-count errors for `GET` and `SET`
- Inline commands (plain text like `PING`, without the array form)
- Nested arrays in the parser
- RESP3 support ( `HELLO 3` handshake and the extra types)
- Rewrite the error message to match real Redis error (80% done)
- Log system to work with the snapshots save 

## Credits

- [Coding Challenges: Build Your Own Redis Server](https://codingchallenges.fyi/challenges/challenge-redis/)
- [Redis Serialization Protocol (RESP) specification](https://redis.io/docs/latest/develop/reference/protocol-spec/)
- [Redis command documentation](https://redis.io/docs/latest/commands/)
