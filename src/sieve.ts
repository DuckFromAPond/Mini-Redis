interface Node {
    key: string;
    visited: boolean;         // SIEVE metadata
    prev: Node | null;
    next: Node | null;
};

// map holds the key of data and its metadata
// T-T
export class Sieve {
    private map = new Map<string, Node>();
    private head: Node | null = null;   // newest: onInsert adds here
    private tail: Node | null = null;   // oldest: the hand starts here
    private hand: Node | null = null;   // where the last eviction stopped
    // TODO work on

    onInsert(key: string): void{};
    onAccess(key: string): void{};
    onDelete(key: string): void{};
    evict(): string | undefined{return};
}