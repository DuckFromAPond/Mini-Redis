# Mini-Redis

A from-scratch implementation of a subset of Redis in TypeScript, built to learn the RESP protocol and how a server turns socket bytes into commands and replies.

## Try it out 

Requires Node.js (a recent version) and, to try the server, `redis-cli` (it comes with Redis).

```bash
git clone https://github.com/DuckFromAPond/Mini-Redis
cd Mini-Redis
npm install
npm start
```

The server listens on port `6379`, the default Redis port. If a real Redis is already running there, stop it first or start this server on another port (`startServer(port)`, see `src/server.ts`). 

```bash
npm start              # port 6379 (default)
npm start -- 7000      # custom port
redis-cli -p 7000 PING
```

In a second terminal:

```bash
redis-cli PING
# PONG
redis-cli SET drink coffee
# OK
redis-cli GET drink
# "coffee"
```

Other scripts:

```bash
npm run dev    # restart the server automatically when files change
npm test       # run the test suite
```

`SAVE` writes a snapshot to `dump.json` in the directory where you started the server, and the server loads it again on startup.

## Built with

- **Language and runtime:** [TypeScript](https://www.typescriptlang.org/) on [Node.js](https://nodejs.org/), using only built-in modules for the server (`node:net`, `node:fs`). No runtime dependencies.
- **Development:** [tsx](https://tsx.is/) to run TypeScript directly (`npm start`, `npm run dev`).
- **Testing:** [Vitest](https://vitest.dev/) for unit and integration tests (`npm test`), and [ioredis](https://github.com/redis/ioredis) as a real client for the connection tests.
- **Manual testing and benchmarking:** `redis-cli` and `redis-benchmark`, which come with Redis.
## Command list
| Command | Syntax                                              | Description                                       | Example                      |
| ------- | --------------------------------------------------- | ------------------------------------------------- | ---------------------------- |
| PING    | `PING [message]`                                    | Check the connection                              | `PING`                       |
| ECHO    | `ECHO message`                                      | Return the given message                          | `ECHO hello`                 |
| SET     | `SET key value [EX seconds  \| PX milliseconds  \| EXAT unix-time-seconds \| PXAT unix-time-milliseconds]` | Store a value, optionally with an expiry     | `SET drink coffee EX 60`     |
| GET     | `GET key`                                           | Read a value (null if the key is missing)         | `GET drink`                  |
| EXIST   | `EXISTS key [key ...]`                              | Count how many of the given keys are present      | `EXISTS drink`               |
| DEL     | `DEL key [key ...]`                                 | Delete keys, returns how many were removed        | `DEL drink`                  |
| INCR    | `INCR key`                                          | Add one to a stored integer                       | `INCR counter`               |
| DECR    | `DECR key`                                          | Subtract one from a stored integer                | `DECR counter`               |
| LPUSH   | `LPUSH key value [value ...]`                       | Push values onto the head of a list               | `LPUSH jobs a b`             |
| LRANGE  | `LRANGE key start stop`                             | Print values between given start and stop index from a given list | `LRANGE jobs 0 3`            |
| RPUSH   | `RPUSH key value [value ...]`                       | Push values onto the tail of a list               | `RPUSH jobs a b`             |
| SAVE    | `SAVE`                                              | Write a snapshot to disk                          | `SAVE`                       |

Commands behave *similarly* to their Redis counterparts, as described in Redis's documentation.

## Design details

How one request moves through the server:

```
client (redis-cli, ioredis)
   │  raw bytes: *2\r\n$3\r\nGET\r\n$5\r\ndrink\r\n
   ▼
server.ts  socket "data" event - (if a SAVE is running: wait in queue)
   │  chunk
   ▼
handleMessages
   │
   ├─ parseCommandBatch/parse ──────────► ["GET", "drink"]        (array of strings)
   │
   ├─ handleCommands ─► looks up the "GET" handler and runs it
   │        │               ▲
   │        └──► store ─────┘         
   │  result: "coffee" 
   │
   ├─ serialize ──────► $6\r\ncoffee\r\n
   │
   │  any thrown Error at any step ──► serialize ──► -ERR message\r\n
   ▼
server.ts  socket.write(reply)
   │
   ▼
client
```
- **Server (`server.ts`):** accepts TCP connections, passes each chunk to `handleMessages`, and writes the reply back.
- **Orchestration (`handleMessages`):** calls `parseCommandBatch`/`parse`, `handleCommands` and `serialize` in order. It wraps all of them in a try/catch, so any thrown error becomes an `-ERR ...` reply and one bad command never crashes the server.
- **Protocol (`parseCommandBatch`/`parse`, `serialize`):** `parseCommandBatch`/`parse` turns RESP into values and `serialize` turns replies back into RESP. Bulk strings are read by declared byte length, so values containing `\r\n` or multibyte characters parse correctly.
- **Commands (`handleCommands`):** handlers live in a lookup map keyed by case-insensitive command name, and a handler throws an `Error` for bad input.
- **Store:** a wrapper around a `Map`. Handlers call it, not `handleMessages`. Expired entries are checked through `getLiveEntry` before they're returned or saved.
- **Replies in order:** `SAVE` is async, so the server queues later chunks from that connection until the save finishes.

## Save details

SAVE writes the current store snapshot as JSON to dump.json in the current working directory. The server loads that snapshot when it starts; missing snapshots start with an empty store, while invalid snapshots or other file errors prevent startup. For an invalid snapshot, the startup error includes the file path and recovery guidance: back up and repair the file, or remove it to start with an empty store, then restart. Expired entries are omitted when saving and loading. startServer accepts an optional second argument to select a different snapshot path.

Command handling stays synchronous for ordinary commands. SAVE is asynchronous, and the server queues later requests from that same connection until the save finishes so replies remain in order.

NOTE: It is noticed that making the normal commands asynchronous with SAVE causes significant overhead on performance as found through Redis benchmark compared to when it is not async. This is most likely due to a combination of old commands already being lightweight and new scheduling cost for each request.

## Performance

Measured locally with `redis-benchmark`. Plain runs use `redis-benchmark -t set,get -n 100000 -q`; pipelined runs use `redis-benchmark -t set,get -n 500000 -P 16 -q` for both Redis and Mini-Redis. Results vary with machine load. Benchmarks were ran 3 times, the table reports the median rather than a range (though the range isn't that wide anyway - around 10,000 at worst). 


It should also be noted that previous versions of the Mini-redis are recorded at different times in development and as such may be under different condition though they are recorded on the **same machine**. Both Real Redis and the Latest Mini-Redis version are recorded after one another and their data below are the most recent recordings. 

#### Plain requests (100,000 requests, default pipeline depth)

| Version                                                    | SET (req/s) | GET (req/s) | p50 SET (ms) | p50 GET (ms) |
| ---------------------------------------------------------- | ---------- | ---------- | ------------ | ------------ |
| Before async changes (`split`/`shift` parser, all sync)    | 76,336     | 80,451     | 0.559        | 0.559        |
| After async changes (every command async)                  | 55,772     | 64,062     | 0.823        | 0.823        |
| Partial async + pointer (only `SAVE` async, cursor parser) | 72,727     | 80,321     | 0.735        | 0.735        |
| Real Redis                                                 | 140,449    | 140,845    | 0.183        | 0.183        |
| Latest Mini-Redis, plain                                   | 129,032    | 131,926    | 0.351        | 0.351        |

#### Pipelined requests (500,000 requests, `-P 16` / batch of 16 commands per network packet)

| Version                            | SET (req/s) | GET (req/s) | p50 SET (ms) | p50 GET (ms) |
| ---------------------------------- | ---------- | ---------- | ------------ | ------------ |
| Real Redis                         | 1,213,592  | 1,506,024  | 0.591        | 0.463        |
| Mini-Redis, before batch fast path | 214,041    | 243,902    | 3.527        | 3.135        |
| (Latest) Mini-Redis, with batch fast path   | 582,750    | 616,522    | 1.471        | 1.407        |

### What the numbers show

- **Making every command async cost the most.** Throughput dropped by roughly 27% for SET and 20% for GET. Ordinary commands were already cheap, so the extra scheduling per request became a large share of the work.
- **Keeping ordinary commands synchronous recovered most of it.** Only `SAVE` is async now.
- **Pipelining reduced per-command socket overhead.** With `-P 16`, the server can process multiple commands received together and combine their replies into one socket write, rather than doing a separate read/response/write cycle for each command.
- **The command-batch fast path improved pipelined throughput further.** Compared with the prior pipelined run, SET throughput rose about 1.9x and GET about 1.8x. It specializes parsing for the common command frame (an array of bulk-string arguments) while other RESP shapes still use the general parser.
- **The latest plain run median is about 99.8k SET and 101.6k GET requests per second.** These are newer measurements than the earlier plain rows; differences between individual benchmark sessions may include machine load as well as code changes.

### Profiling

A CPU profile (`node --cpu-prof`) during a 500,000-request plain benchmark initially showed about 75% of profile time in the socket write path (`writeUtf8String` alone was about 70% self time) and about 17% in parsing. This indicated that reducing parser work alone would have limited impact, while batching commands could reduce socket-write overhead.

After adding pipelined command handling and the specialized batch parser, a profile of the optimized `-P 16` run showed a different distribution:

| Profile function       | Total time | Self time |
| ---------------------- | ---------- | --------- |
| `writeUtf8String`      | ~45%       | ~42%      |
| `utf8Slice`            | ~12%       | ~11%      |
| `handleMessages`       | ~39%       | ~5.6%     |
| `parseCommandBatch`    | ~22%       | ~4.3%     |
| `handleCommands`       | ~7.4%      | ~4.5%     |

The total-time percentages overlap because profiler entries include time spent in their child calls; self-time percentages are the non-overlapping portion. Profiling adds overhead, so treat these as proportions rather than exact costs.

**What led to the improvement:** the initial profile identified socket writes as the main cost for individual requests. Pipelining amortized that work across commands by parsing a batch and writing combined replies. Profiling then showed parsing of the common RESP command shape was a remaining opportunity, so `parseCommandBatch` was added to scan bulk-string arrays directly from the input buffer, avoiding some general-parser work and intermediate conversions. The optimized profile still shows socket writing and UTF-8 conversion as significant costs, so further tuning should be guided by repeated benchmarks and profiles.

#### Why parseCommandBatch helps

The general parser (`parse`) handles every RESP type. It reads each line by searching for `\r\n` (`Buffer.indexOf`), turns the line into a string, checks it with a regex and converts it with `Number()`. Nearly every client command has one shape, though: an array of bulk strings, such as `*3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$5\r\nvalue\r\n`. For that shape, four of the seven lines are only length headers (`*3`, `$3`, ...) made of digits.

`parseCommandBatch` handles only that shape and works directly on the bytes:

- **Length headers are read as numbers byte by byte** (`readAsciiInteger`), so there is no `indexOf` call, no temporary string, no regex and no `Number()` for them. The profile before this change showed those costs under `indexOfBuffer`, `utf8Slice`, `toString` and `parseInteger`.
- **Only the argument values become strings,** which the command handlers need anyway.
- **It loops over the whole chunk** and builds the final `string[][]` that `handleCommands` expects, without recursion or an intermediate `RespValue` structure.
- **Anything else returns `undefined`** and falls back to the general parser, so unusual input behaves as before.

In the `-P 16` profile, parsing fell from about 47% of the time to about 22%. Socket writing now takes a larger *share* (about 45%, up from about 33%), but that's because the rest of the profile shrank, not because writing got slower.

**Trade-off**: parseCommandBatch duplicates some parsing logic for the common command-array format. It handles that specific pattern; other input falls back to the general parser.

## Future improvements

- Look into application of SIEVE/S3-FIFO for store
- Log system to work with the snapshots save 
- Argument-count errors for `GET` and `SET`
- Inline commands (plain text like `PING`, without the array form)
- RESP3 support ( `HELLO 3` handshake and the extra types)

## Credits

- [Coding Challenges: Build Your Own Redis Server](https://codingchallenges.fyi/challenges/challenge-redis/)
- [Redis Serialization Protocol (RESP) specification](https://redis.io/docs/latest/develop/reference/protocol-spec/)
- [Redis command documentation](https://redis.io/docs/latest/commands/)