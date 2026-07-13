/**
 * Hiring verdict ranks awarded at the end of a run, selected by WPM band. Written in the
 * voice of a smug AI copilot delivering the hiring committee's verdict on your technical
 * screen for a vibe coding role.
 */
import type { RankTitle } from '@/game/types';

/** Exactly 10 entries, sorted ascending by minWpm. First entry's minWpm is 0. */
export const RANK_TITLES: RankTitle[] = [
    {
        minWpm: 0,
        title: 'Auto-Rejected by ATS',
        blurb: 'The applicant tracking system saw this and filed it under "please do not."',
        emoji: '🐌',
    },
    {
        minWpm: 20,
        title: 'Ghosted After Round One',
        blurb: 'We said we would follow up. We will not. This is the follow up.',
        emoji: '👻',
    },
    {
        minWpm: 30,
        title: 'Take-Home Assignment Casualty',
        blurb: 'You opened the repo. That took effort. The effort stopped there.',
        emoji: '💀',
    },
    {
        minWpm: 40,
        title: 'Unpaid Intern, Probably',
        blurb: 'Enthusiastic, unsupervised, and one syntax error from a small fire.',
        emoji: '📎',
    },
    {
        minWpm: 50,
        title: 'Culture Fit (Unfortunately)',
        blurb: 'The code is mediocre but you know all our Slack emojis. Welcome aboard.',
        emoji: '🙂',
    },
    {
        minWpm: 62,
        title: 'Mid-Level Vibe Engineer',
        blurb: 'Ships things. Some of them work. We have decided not to ask which.',
        emoji: '⌨️',
    },
    {
        minWpm: 78,
        title: 'Senior Vibes Architect',
        blurb: 'You do not write code so much as summon it, and we respect that.',
        emoji: '☕',
    },
    {
        minWpm: 95,
        title: 'Principal Prompt Whisperer',
        blurb: 'The copilot listens to you. We are not entirely sure why. Neither are you.',
        emoji: '⚖️',
    },
    {
        minWpm: 115,
        title: 'Founding Vibe Engineer',
        blurb: 'Triple digits. HR has already drafted your equity grant and your legend.',
        emoji: '🚀',
    },
    {
        minWpm: 140,
        title: 'CTO of Vibes',
        blurb: 'We have nothing left to teach you. Please, teach us. Take the building.',
        emoji: '🧠',
    },
];

/** Returns the highest rank whose minWpm is <= the given wpm. */
export function getRankForWpm(wpm: number): RankTitle {
    let selected = RANK_TITLES[0];
    for (const rank of RANK_TITLES) {
        if (wpm >= rank.minWpm) {
            selected = rank;
        } else {
            break;
        }
    }
    return selected;
}
