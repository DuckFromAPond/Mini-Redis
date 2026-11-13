interface Node {
    key: string;
    visited: boolean; 
    prev: Node | null;
    next: Node | null;
    // note: prev is on the side of the head so prev <-> curr <-> next
};

/** Tracks keys for SIEVE eviction. Accessed keys receive a second chance before eviction. */
export class Sieve {
    private map = new Map<string, Node>();
    private head: Node | null = null;   // for addding new 
    private tail: Node | null = null;   // for the hand to start at
    private hand: Node | null = null;   // where the last eviction stopped

    // helper function that removes a node from the list and repairs head, tail & hand (not delete it yet)
    private unlink(node: Node): void {
        // hand moves toward the head if the node is at the hand 
        if (this.hand === node) { 
            this.hand = node.prev; 
        } 

        // change the previous node's next to point to the node after the current node (if it exists)
        if (node.prev) { 
            node.prev.next = node.next;
        } 
        else { 
            // change the head instead if the previous node doesn't exist (node is the head)
            this.head = node.next;                    
        } 

        // update next node's prev if exist 
        if (node.next) { 
            node.next.prev = node.prev;
        } 
        else { 
            // update tail instead if not (node was the tail)
            this.tail = node.prev;
        }

        // free up node's pointer
        node.prev = null;
        node.next = null;
    }
    
    // for inserting into the sieve map (linked list)
    onInsert(key: string): void {
        // if already in the list then return (access will set visited instead)
        if (this.map.has(key)) return;

        // initialize node
        const node: Node = { key, visited: false, prev: null, next: this.head };

        // if node at head exist then change the head nodes's prev to point to the new node 
        if (this.head) { 
            this.head.prev = node;
        }
        
        this.head = node;
        
        // if tail does not exist then set tail as node
        if (!this.tail) { 
            this.tail = node;
        }
        
        this.map.set(key, node);
    }

    // on access set visited
    onAccess(key: string): void {
        const node = this.map.get(key);

        if (node) { 
            node.visited = true;
        } 
    }

    // delete entry when entry is deleted on the other map 
    onDelete(key: string): void {
        const node = this.map.get(key);
        if (!node) return;

        this.unlink(node);
        this.map.delete(key);
    }


    /**
     * Evicts the next unvisited key, clearing visited bits as the hand scans the list.
     *
     * @returns The evicted key, or `undefined` if the list is empty.
     */
    evict(): string | undefined {
        // get node at the hand or if hand is null go to tail 
        let node = this.hand ?? this.tail;

        // move through visited nodes, clearing their bit, then wrap to the tail if go past the head 
        while (node && node.visited) {
            node.visited = false;
            node = node.prev ?? this.tail;
        }

        // empty list
        if (!node) return undefined;              

        // get key of the data stored node to evict in the store map 
        const key = node.key;
        
        // decide node to set hand to 
        const nextHand = node.prev ?? this.tail;
        this.unlink(node);

        // update hand 
        this.hand = (nextHand === node) ? null : nextHand;
        this.map.delete(key);

        // return key 
        return key;
    }
}