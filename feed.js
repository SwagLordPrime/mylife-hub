/* MyLife status feed slot (v1).
   The hub shows a state only when a check the room already runs puts it here. No room check writes this file yet,
   so it ships empty and every tile reads UNKNOWN. The hub never fetches anything to fill it; it makes no network
   call of its own. A later, separately approved step may write this file, in the shape below.

   Shape (version 1), all times ISO 8601 with offset:
   window.MYLIFE_FEED = {
     version: 1,
     source: "<name of the check that wrote this>",          // shown on the Channel Guide
     read_at: "2026-10-24T08:02:00-05:00",                    // older than 24 h: the feed is not trusted, all UNKNOWN
     directive: null | { label: "01", line1: "...", hero: "...", route: "01", priority: "A" | "ROUTINE", done: false },
     channels: { "01": { state: "HEALTHY" | "STALE" | "OFFLINE" | "UNKNOWN", check: "<check name>",
                         checked_at: "<ISO>", last_seen: "<ISO, needed for STALE>" }, ... }
   };
   A channel missing from the feed, or with a state the hub cannot verify (no check name, no time), reads UNKNOWN. */
window.MYLIFE_FEED = null;
