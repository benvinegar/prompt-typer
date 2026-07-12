/**
 * Data for engine-injected subagent swarms. Unlike the rest of `src/data/`, these are NOT tied
 * to any scenario — the game engine (`src/game/use-game.ts`) injects a swarm beat purely by
 * round depth (rounds 2, 4, 6, and every even round after that), regardless of what the player
 * just typed. The comedy is the mismatch: 128 subagents dispatched over a CSS centering
 * question. `detail` strings here are therefore deliberately task-agnostic, just absurdly
 * specific about HOW the (irrelevant) swarm organized itself.
 */
import type { ResponseBeat } from '@/game/types';

/** Swarm size tier. Round 2 -> 'small', round 4 -> 'medium', round 6+ (every even round) -> 'large'. */
export type SwarmTier = 'small' | 'medium' | 'large';

/** Candidate subagent counts per tier; one is drawn uniformly at random per swarm. */
const SWARM_COUNTS: Record<SwarmTier, number[]> = {
    small: [3, 5, 8],
    medium: [15, 25, 40],
    large: [128],
};

/**
 * Flavor text for the `detail` field of an injected `subagents` beat, per tier. Rendered by
 * `SubagentsRow` as `Task (${count} subagents: ${detail})`, so each entry should read as a
 * continuation of "N subagents:" -- plain ASCII, under ~70 chars, and never referencing the
 * scenario's actual task.
 */
const SWARM_DETAILS: Record<SwarmTier, string[]> = {
    small: [
        'one to do it, two to review each other',
        'each testing a different interpretation of what you said',
        'a pair plus a tiebreaker, democracy in action',
        'three strangers, zero context, one shared goal',
        'one optimist, one pessimist, one just along for it',
    ],
    medium: [
        'a working group, a steering committee, and one actually working',
        'organized into pods, none of which know the others exist',
        'a task force assembled to form a task force',
        'split evenly into optimists and people who read the prompt',
        'a strike team, a review board, and a lot of Slack channels',
    ],
    large: [
        'one per file in the repo, none aware of the others',
        'a full org chart, freshly hired, all reporting to nobody',
        'enough to found a small nation, none of it incorporated',
        'every seat in the building plus several from next door',
        'one per line of the prompt, several per punctuation mark',
    ],
};

/** Picks a random `detail` flavor string for the given tier. */
export function pickSwarmDetail(tier: SwarmTier): string {
    const pool = SWARM_DETAILS[tier];
    return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Picks a random subagent count for the given tier. */
export function pickSwarmCount(tier: SwarmTier): number {
    const pool = SWARM_COUNTS[tier];
    return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * Builds a fresh `subagents` response beat for the given tier: a random count paired with a
 * random flavor detail, both drawn independently so repeats stay unpredictable across a run.
 */
export function buildSwarmBeat(tier: SwarmTier): Extract<ResponseBeat, { kind: 'subagents' }> {
    return {
        kind: 'subagents',
        count: pickSwarmCount(tier),
        detail: pickSwarmDetail(tier),
    };
}
