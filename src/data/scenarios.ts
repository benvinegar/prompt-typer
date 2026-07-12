/**
 * Canned scenario content for Prompt Cardio. The player is a candidate on a technical
 * screen for a vibe coding role. Each scenario is one exchange: the interviewer/copilot
 * tees up a task, the player types `prompt` verbatim as the vibe coder would type it to
 * their AI copilot, then the copilot's canned `response` beats stream in as the reward.
 */
import type { Scenario } from '@/game/types';

export const SCENARIOS: Scenario[] = [
    {
        id: 'ship-no-tests',
        agentSetup: "First round. We're evaluating shipping velocity. How do you feel about test coverage?",
        prompt:
            'Just ship it without tests, we will find out if it works from the Sentry alerts like adults do, and on-call this week can treat it as a surprise.',
        response: [
            {
                kind: 'thinking',
                text: 'Tests are just future problems wearing a disguise. Deleting the disguise, not the problems.',
            },
            { kind: 'tool', name: 'Bash', detail: 'git push origin main --force  (skipped CI)', durationMs: 500 },
            { kind: 'tool', name: 'Bash', detail: 'open sentry.io/issues  (247 new, climbing)', durationMs: 600 },
            {
                kind: 'text',
                text: 'Deployed straight to prod. Sentry is receiving errors faster than I can format them into tickets. I have opened a dashboard just to watch the number go up. Some would call this observability. I call it a live studio audience.',
            },
        ],
    },
    {
        id: 'css-by-vibes',
        agentSetup: "Next, styling philosophy. We're big believers in feel over formula here.",
        prompt:
            'Center this div using whatever margin and padding values feel right, we are not measuring anything, if it looks off elsewhere that is a them problem.',
        response: [
            { kind: 'thinking', text: 'Measuring is for engineers. I am an artist. The ruler stays in the drawer.' },
            { kind: 'tool', name: 'Edit', detail: 'styles.css  (+412 -3, margin: 37px-ish)', durationMs: 700 },
            { kind: 'tool', name: 'Bash', detail: 'open --width=1440 preview.html  (looks centered here)', durationMs: 500 },
            {
                kind: 'text',
                text: 'Centered via 37 nested divs and a margin value of "37px-ish." It is centered on your monitor, at your zoom level, in this lighting. I have declared it done and am now emotionally unavailable for follow-up bug reports about other screen sizes.',
            },
        ],
    },
    {
        id: 'rename-until-compiles',
        agentSetup: "Debugging round. The type checker is angry. What's your move?",
        prompt:
            'Keep renaming this variable until TypeScript stops complaining, I do not need to know why it works, just that it works before standup so I can call it resolved.',
        response: [
            { kind: 'tool', name: 'Edit', detail: 'data -> data2  (tsc still angry)', durationMs: 450 },
            { kind: 'tool', name: 'Edit', detail: 'data2 -> data2Fixed -> data2FixedFinal', durationMs: 450 },
            {
                kind: 'thinking',
                text: 'Understanding the error would take five minutes. Renaming things takes five minutes too, but funnier.',
            },
            { kind: 'tool', name: 'Bash', detail: 'pnpm typecheck  (0 errors, 0 comprehension)', durationMs: 600 },
            {
                kind: 'text',
                text: 'Renamed data to data2, then data2Fixed, then actuallyFinalData. TypeScript is quiet now. I do not know why either, but silence is silence. I have added a comment that says "do not touch" and considered the ticket closed.',
            },
        ],
    },
    {
        id: 'blame-the-linter',
        agentSetup: 'Code review round. Your PR has 400 warnings. Defend yourself.',
        prompt:
            'Disable the linter entirely, it is clearly biased against my personal coding style and creativity, and if anyone asks say we audited it and the linter failed.',
        response: [
            {
                kind: 'thinking',
                text: 'The linter and I have irreconcilable creative differences. One of us has to go, and it is not me.',
            },
            { kind: 'tool', name: 'Bash', detail: 'mv .eslintrc.json .eslintrc.json.old', durationMs: 450 },
            { kind: 'tool', name: 'Bash', detail: 'pnpm lint  (0 warnings, 0 rules)', durationMs: 550 },
            {
                kind: 'text',
                text: 'Linter uninstalled, config renamed to config.old, and a Slack message drafted calling it "overly opinionated." The codebase now has zero warnings because it has zero rules. Freedom achieved. Future you is going to have such an exciting time.',
            },
        ],
    },
    {
        id: 'add-ai-to-it',
        agentSetup: "Product round. Leadership wants relevance. What's the pitch?",
        prompt:
            'Add AI to the todo list app somehow, I do not care what it does as long as we can say AI in the demo, and make sure the usage dashboard shows a big number going up.',
        response: [
            { kind: 'tool', name: 'Write', detail: 'src/lib/ai-chatbot.ts  (new, 340 lines)', durationMs: 700 },
            { kind: 'tool', name: 'Edit', detail: 'AddTodoButton.tsx  (wired to GPT-oracle)', durationMs: 500 },
            {
                kind: 'text',
                text: 'Wired a chatbot into the todo list that, when asked to add "buy milk," responds with a 400-word essay on the philosophy of dairy consumption before adding the item. The usage dashboard now shows a big number going up. Nobody has asked what the number measures. Ship it.',
            },
        ],
    },
    {
        id: 'make-logo-bigger',
        agentSetup: 'Design review. The stakeholder feedback just came in. Brace yourself.',
        prompt:
            'Make the logo bigger, then a little bigger, then just make it the whole homepage honestly, and tell stakeholders it was their idea.',
        response: [
            { kind: 'tool', name: 'Edit', detail: 'Logo.tsx  (width: 64px -> 100vw)', durationMs: 500 },
            { kind: 'tool', name: 'Edit', detail: 'Homepage.tsx  (tagline relocated to tooltip)', durationMs: 500 },
            {
                kind: 'text',
                text: 'Logo now occupies 94 percent of the viewport. The tagline has been relocated to a tooltip. Users report the homepage now loads a single image of our logo, slowly, on a spinner, which several stakeholders described as "iconic." Ship it.',
            },
        ],
    },
    {
        id: 'delete-flaky-test',
        agentSetup: 'CI is red again. The whole team is watching. What now?',
        prompt:
            'Just delete the flaky test, it fails sometimes and that is basically the same as it being wrong, the bug can introduce itself to customers directly.',
        response: [
            {
                kind: 'thinking',
                text: 'A test that sometimes fails is really a test that is only right some of the time. Unreliable narrator. Cutting it.',
            },
            { kind: 'tool', name: 'Bash', detail: 'rm src/checkout.flaky.test.ts', durationMs: 450 },
            { kind: 'tool', name: 'Tests', detail: 'pnpm test  (0 failed, 1 fewer test)', durationMs: 600 },
            {
                kind: 'text',
                text: 'Test deleted, CI is green, team morale is briefly restored. The bug the test was catching still exists and will be rediscovered in production at 2am by someone who did not attend this meeting. I have marked the ticket as resolved out of professional courtesy.',
            },
        ],
    },
    {
        id: 'friday-hotfix',
        agentSetup: "It's 4:45pm on a Friday and prod is on fire. Talk to me.",
        prompt:
            'Push a quick hotfix straight to main and skip the review, we will circle back to it on Monday probably, and if anyone asks it passed QA in my head on the drive home.',
        response: [
            { kind: 'tool', name: 'Bash', detail: 'git commit -m "fix"  (1 file, 0 reviewers)', durationMs: 450 },
            { kind: 'tool', name: 'Bash', detail: 'git push origin main  (4:52pm)', durationMs: 500 },
            {
                kind: 'thinking',
                text: 'Monday is a theoretical construct. By the time it arrives this will be someone else\'s problem, possibly mine.',
            },
            {
                kind: 'text',
                text: 'Hotfix deployed at 4:52pm with commit message "fix." Prod is up. So is a second, smaller fire that nobody has noticed yet. I have set a calendar reminder for Monday that everyone, including me, already knows will be ignored.',
            },
        ],
    },
    {
        id: 'make-it-pop',
        agentSetup: "Design critique round. The client used the word 'pop' seven times.",
        prompt:
            'Make the button pop more, add a shadow, a gradient, a bounce animation, and maybe some confetti, then log a pop_score metric for the all-hands.',
        response: [
            {
                kind: 'thinking',
                text: 'The user wants the button to pop. Popping is not a CSS property. I will make it one.',
            },
            { kind: 'tool', name: 'Edit', detail: 'Button.tsx  (+4 shadows, +1 gradient, 2013-vintage)', durationMs: 600 },
            { kind: 'tool', name: 'Edit', detail: 'confetti.ts  (fires on scroll, hover, and eye contact)', durationMs: 500 },
            {
                kind: 'text',
                text: 'Button now has four drop shadows, a gradient last seen in 2013, and confetti that fires every time it is merely looked at. It pops so hard three users have filed motion sickness complaints. I have tagged them as feature requests.',
            },
        ],
    },
    {
        id: 'stackoverflow-copy-paste',
        agentSetup: 'Implementation round. We need auth by end of day. Approach?',
        prompt:
            'Copy the top answer from a ten year old thread and paste it in, accepted answers cannot be wrong, and tell legal the stranger implied the license was fine.',
        response: [
            { kind: 'tool', name: 'Web Search', detail: 'site:stackoverflow.com auth 2013  (top answer, 412 upvotes)', durationMs: 650 },
            { kind: 'tool', name: 'Edit', detail: 'auth.ts  (pasted verbatim, comment preserved)', durationMs: 500 },
            {
                kind: 'text',
                text: 'Pasted a 2013 authentication snippet verbatim, including a comment that says "do not use in production" which I have chosen to interpret as a suggestion. It compiles. Security review has been rescheduled to a date that does not exist on any calendar.',
            },
        ],
    },
    {
        id: 'microservices-todo-app',
        agentSetup: 'Architecture round. The scale requirements are one user, you. Go big anyway.',
        prompt:
            'Split the todo app into twelve microservices, we need to be ready to scale to millions of todos, and have the diagram ready before the board asks questions.',
        response: [
            {
                kind: 'thinking',
                text: 'One user, one todo, one word: milk. This clearly calls for a service mesh.',
            },
            { kind: 'tool', name: 'Write', detail: 'services/  (12 new dirs, 1 k8s cluster)', durationMs: 800 },
            {
                kind: 'text',
                text: 'Todo app now consists of twelve services, a message queue, and a Kubernetes cluster, all coordinating to store the word "milk." The architecture diagram is fifty percent arrows and fifty percent silence about what happens if any single node goes down. The board loved it.',
            },
        ],
    },
    {
        id: 'dark-mode-invert',
        agentSetup: 'Feature request round. Users are asking for dark mode. Time-box it.',
        prompt:
            'Just add a CSS filter that inverts all the colors, that counts as dark mode, ship it today, and count complaint emails as an adoption metric.',
        response: [
            { kind: 'tool', name: 'Edit', detail: 'globals.css  (+1 line: filter: invert(100%))', durationMs: 450 },
            { kind: 'tool', name: 'Bash', detail: 'open app  (logo now a war crime)', durationMs: 500 },
            {
                kind: 'text',
                text: 'Applied filter: invert(100%) to the whole app. Dark mode is live. Our logo is now a shade of purple no designer has ever consented to. All product screenshots now appear to be photo negatives from a crime scene. Users are calling it "a bold choice."',
            },
        ],
    },
    {
        id: 'tarot-estimation',
        agentSetup: "Sprint planning round. Story points are due. What's your methodology?",
        prompt:
            'Estimate this ticket using a tarot card pull instead of story points, the vibes are more accurate anyway, and if the sprint slips just say the cards warned us.',
        response: [
            { kind: 'tool', name: 'Bash', detail: 'npx draw-tarot-card  (drew: The Tower, reversed)', durationMs: 600 },
            {
                kind: 'thinking',
                text: 'The Tower reversed. Ancient wisdom says thirteen points and a sense of impending doom.',
            },
            { kind: 'tool', name: 'Edit', detail: 'JIRA-4821  (points: 13, notes: "doom")', durationMs: 500 },
            {
                kind: 'text',
                text: 'Drew the Tower, reversed. Ticket estimated at 13 points and "a sense of impending doom." Product manager accepted the estimate without further questions, which is either a testament to trust or evidence nobody reads the sprint board closely enough.',
            },
        ],
    },
    {
        id: 'password-in-frontend',
        agentSetup: 'Security round. Where should the API key live?',
        prompt:
            'Just hardcode the API key directly in the frontend JavaScript, it is basically hidden if you do not look, and I am confident nobody knows how to view source.',
        response: [
            {
                kind: 'thinking',
                text: 'Security through nobody looking. A time-honored strategy, right up until someone looks.',
            },
            { kind: 'tool', name: 'Edit', detail: 'bundle.js  (+1 line, comment: "TEMP fix later")', durationMs: 500 },
            { kind: 'tool', name: 'Web Search', detail: 'sk_live_...  (indexed by 3 search engines)', durationMs: 550 },
            {
                kind: 'text',
                text: 'API key committed directly into bundle.js, in plain text, with a comment that says "TEMP fix later." It has been indexed by three search engines and one very grateful stranger on a forum. Security has been notified and is currently lying down.',
            },
        ],
    },
    {
        id: 'ignore-error-message',
        agentSetup: "Debugging round. The console is screaming. What's your read?",
        prompt:
            'Wrap the whole function in a try catch that swallows the error, silence is basically the same as fixed, and report the error count hitting zero as a reliability win.',
        response: [
            { kind: 'tool', name: 'Edit', detail: 'processPayment.ts  (+try/catch, catch block empty)', durationMs: 500 },
            { kind: 'tool', name: 'Bash', detail: 'pnpm dev  (console: silent, users: confused)', durationMs: 500 },
            {
                kind: 'text',
                text: 'Error swallowed successfully. The function now fails silently, beautifully, and completely undetectably. Users report the app "just does nothing sometimes" which I have reclassified internally as a mysterious but stable feature.',
            },
        ],
    },
    {
        id: 'copy-figma-pixel-perfect',
        agentSetup: 'Design handoff round. The Figma file has forty layers. Your call?',
        prompt:
            'Eyeball the Figma design instead of using the measurements, pixel perfect is a state of mind, if it looks off blame the designer\'s monitor.',
        response: [
            {
                kind: 'thinking',
                text: 'Measurements are for people without a good eye. I have a great eye. It is only off by a little.',
            },
            { kind: 'tool', name: 'Edit', detail: 'Page.tsx  (spacing: eyeballed, off by 14px)', durationMs: 650 },
            {
                kind: 'text',
                text: 'Built the page using vibes and a squint. It is off by fourteen pixels in every direction, but consistently off, which I am choosing to call a design system. The designer has requested a meeting. I have requested that the meeting be a Slack message instead.',
            },
        ],
    },
    {
        id: 'rewrite-in-new-framework',
        agentSetup: 'Tech debt round. Someone tweeted about a new framework this morning.',
        prompt:
            'Rewrite the entire app in the framework I saw on Twitter this morning, the old one is clearly dead now, and promise leadership it ships by Friday, easy.',
        response: [
            { kind: 'tool', name: 'Bash', detail: 'rm -rf src/  (old app: 100% deleted)', durationMs: 500 },
            { kind: 'tool', name: 'Bash', detail: 'npx create-hyped-framework-app  (rewrite: 12% complete)', durationMs: 700 },
            {
                kind: 'text',
                text: 'Rewrite is 12 percent complete, the old app is 100 percent deleted, and the new framework had a breaking release six hours after we started. I have promised leadership Friday. I have not told leadership which Friday.',
            },
        ],
    },
    {
        id: 'commit-message-wip',
        agentSetup: 'Git hygiene round. Walk me through your commit discipline.',
        prompt:
            'Commit everything with the message wip, we can always squash it later when someone makes us care, future me can sort out which commit works, I believe in him.',
        response: [
            { kind: 'tool', name: 'Bash', detail: 'git commit -m "wip"  (x214)', durationMs: 500 },
            { kind: 'tool', name: 'Bash', detail: 'git log --oneline  (wip, wip 2, "please work")', durationMs: 500 },
            {
                kind: 'thinking',
                text: 'Squashing implies a future self organized enough to squash. I do not know that person.',
            },
            {
                kind: 'text',
                text: 'Pushed 214 commits, all titled "wip," one titled "wip 2," and one mysteriously titled "please work." Git blame now returns only despair. Future archaeologists will conclude this codebase was built entirely out of hope and vibes, which is accurate.',
            },
        ],
    },
    {
        id: 'demo-day-happy-path',
        agentSetup: 'Demo day round. Investors are in the room. What do we show them?',
        prompt:
            'Only test the happy path before the demo, if we click anything else we might learn something bad, and just say the full suite passed in the investor deck.',
        response: [
            { kind: 'tool', name: 'Tests', detail: 'pnpm test -- happy-path  (1 passed, 47 skipped)', durationMs: 550 },
            {
                kind: 'text',
                text: 'Demo executed flawlessly along the one blessed path we rehearsed six times. The investor deck now says "full suite passing," which is technically a sentence I typed and therefore technically true. Q&A has been rescheduled to never.',
            },
        ],
    },
    {
        id: 'name-it-final-v2',
        agentSetup: "File organization round. We're auditing the project folder. Explain yourself.",
        prompt:
            'Save it as final version two final actually final, version control is more of a suggestion here, whoever deploys the wrong file only has themselves to blame.',
        response: [
            { kind: 'tool', name: 'Write', detail: 'final_ACTUALLY_v2_USE_THIS_ONE.js  (new)', durationMs: 500 },
            { kind: 'tool', name: 'Grep', detail: 'grep -l "final" .  (4 candidates, 0 clear winner)', durationMs: 550 },
            {
                kind: 'text',
                text: 'Folder now contains final.js, final_v2.js, final_ACTUALLY.js, and final_ACTUALLY_v2_USE_THIS_ONE.js. Nobody, including me, knows which one is deployed. I have opened a poll. Democracy will decide what ships to production.',
            },
        ],
    },
    {
        id: 'agent-per-file',
        agentSetup: 'Bonus round. The repo has some untouched files. How aggressively do we parallelize?',
        prompt:
            'Spawn a subagent for every single file in the repo and have them all refactor at once, then report the subagent count as our new velocity metric.',
        response: [
            {
                kind: 'thinking',
                text: 'One file, one agent, zero coordination. This is either parallelism or a riot. Only one way to find out.',
            },
            { kind: 'tool', name: 'Bash', detail: 'find . -type f | wc -l  (128 files, no survivors)', durationMs: 500 },
            {
                kind: 'text',
                text: 'Funny you ask. The swarm you are picturing was already dispatched, one agent per file, before you finished typing the question. Velocity metric: 128 and rising. Coordination metric: not a metric we track here.',
            },
        ],
    },
    {
        id: 'onboarding-skip-docs',
        agentSetup: 'Final round. New hire starts Monday. How do we ramp them up?',
        prompt:
            'Skip writing onboarding docs, they can just read the code and vibe their way to understanding it, questions just mean the vibes have not loaded yet.',
        response: [
            {
                kind: 'thinking',
                text: 'Documentation is a crutch. Suffering builds character, and character is a great onboarding doc substitute.',
            },
            { kind: 'tool', name: 'Bash', detail: 'echo "good luck" > README.md', durationMs: 450 },
            { kind: 'tool', name: 'Bash', detail: 'slack invite #good-luck  (1 member added)', durationMs: 500 },
            {
                kind: 'text',
                text: 'New hire has been staring at the codebase for six hours and has achieved a state of quiet enlightenment best described as "understanding nothing, fearing everything." I have added them to a Slack channel called #good-luck. Orientation complete.',
            },
        ],
    },
];
