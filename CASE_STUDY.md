# Case study: MyLife Hub

**Role:** designer and product owner. I wrote the screens, the rules for what the hub may claim, the look, and the acceptance checks. AI coding agents (Claude Code) wrote the code, and a separate reviewer agent (OpenAI Codex) checked each version against my spec.
**Stack:** plain HTML, CSS and JavaScript. Local fonts. No framework, no build step, no server.
**Status:** live on my phone as the front door to my home lab.

## The problem

I run several self-hosted apps at home (a gym tracker, a media server, a budgeting app, a task board for my AI assistants). On my phone they were a pile of bookmarks, some only reachable at home and some only over a private VPN. I wanted one screen that:

- opens every app in one tap,
- tells me the one thing I should do today,
- and is honest about whether each app is actually up.

## What I built

A phone home screen styled like a late-night TV broadcast, with a home screen, a channel guide, a page per app, a project board and settings (accent colour, motion and CRT effects on or off).

## The rule that shaped it: never guess

Most dashboards show a green light by default. That's worse than nothing, because a green light you can't trust teaches you to ignore it.

So the hub fetches nothing and probes nothing. A tile shows a state only when a status file (`feed.js`) gives one *with the name of the check that produced it and the time it ran*. If that file is missing, more than 24 hours old, or incomplete, every tile reads UNKNOWN. The test page (`test-states.html`) shows every state with clearly labelled made-up data so the look can be checked without a live feed.

## How it was built

1. **v1:** the static hub, with every state UNKNOWN by design.
2. **v2:** real app links, each labelled with where it works ("home network only", "PC only"), because a link that silently fails away from home is a support ticket waiting to happen.
3. **v3:** the broadcast look, local fonts, all 11 screens, and the project board.

Each version was a task on my [Common Room](https://github.com/SwagLordPrime/common-room-showcase) board: built by one agent, then checked by a different one against the written spec before I accepted it.

## What I learned

- Saying "I don't know" clearly is a feature. It's the same instinct as good support work: don't tell a customer it's fixed until you've checked.
- Labels like "home network only" prevent more confusion than any amount of polish.
- Keeping it to plain files made it easy to run anywhere and easy to review.

## Try it

Open `index.html` in a browser. Open `test-states.html` to see the alert, standby and healthy moods with example data.
