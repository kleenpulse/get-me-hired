# Get Me Hired: Functional Requirements (FRD)

| | |
|---|---|
| Status | Draft v0.4 |
| Date | 2026-11-14 |
| Owner | Vxrcel |
| License (planned) | MIT |
| Platform | Web app on Netlify (static, no server). Desktop app later. |
| Related | `get-me-hired` agent skill (same method and the same data files) |

## 1. Purpose

Get Me Hired is a free, open-source web app that helps people find startup jobs before everyone else does. Each day it finds:

- **fresh hiring posts**: under 24 hours old, with under 100 likes
- **startups that just raised a seed round**, where the founders still hire people themselves

For each lead, it shows who to write to and facts worth mentioning. It also tracks every lead from "found" to "offer".

The person writes and sends every email themselves. The app never writes or sends outreach.

It's for people who would never open a terminal: designers, marketers, ops people, new grads, and career switchers. You open a link, add an AI key, and press one button. Nothing to install. The `get-me-hired` agent skill already does this work inside coding agents. This app brings the same method to everyone else.

## 2. Background: the method

Applying through job boards puts you in a pile of hundreds. Two things work better:

1. **Answer hiring posts early.** Reply to "we're hiring" posts in their first day, while they have under 100 likes. Email the person who posted, not the form.
2. **Follow seed funding news.** A startup that just raised starts hiring, and its founders decide fast. Learn what they do, pick up to 3 people (founders first), and email them.

The rules: about 20 short emails a day, written by you (short, direct, a bit messy beats polished AI text), and follow-ups when nobody replies. The app does the searching, checking and tracking. The person does the writing.

## 3. Users

| Persona | Who | What they need |
|---|---|---|
| **Job seeker (primary)** | Not technical. Has a CV and a LinkedIn profile, maybe a portfolio. | Open a link, answer a few questions, press one button, get a clear list of who to email today. No jargon. |
| **Power user** | Comfortable with settings and API keys. May already use the agent skill. | Choice of AI and search provider, control over sources and cost. Shares data with the skill. |
| **Contributor** | Developer or designer on GitHub. | Clear modules, adding a provider or source without touching the core, test fixtures. |

## 4. Principles (these win every tie)

1. **Your words, not ours.** The app never drafts or sends outreach emails. It gives facts ("hooks") and can check a draft the user wrote.
2. **Checked, not assumed.** A post counts as fresh only when its age was checked. Every email address carries a confidence label. Every claim links to its source.
3. **Local-first, no server.** The app is a static site. Profile, leads, history and keys live in the user's browser, or in a folder they choose. Requests go only from the browser to the providers the user picked. There's no account and no server of ours, so nothing passes through us.
4. **Bring your own provider.** Users pick their AI provider and, if they want, a search provider. The app is not tied to one company.
5. **Public data only.** No logging in to LinkedIn or X to scrape, no leaked databases, no testing email addresses against mail servers, no personal phone numbers or home addresses.
6. **Plain English.** Every screen makes sense to someone who has never heard the words "API", "CSV" or "seed round". Explain terms the first time they show up.
7. **Honest about gaps.** If a search finds nothing, or a fact can't be checked, the app says so. It never fills the gap with a guess.

## 5. Scope

**In scope (v1, web)**
- A static web app on Netlify that can be installed as a home-screen or desktop app (PWA)
- Several AI providers, and search through the AI provider's built-in web search or an optional Firecrawl key
- Onboarding that builds the profile from a CV, a LinkedIn PDF export, a portfolio URL, or a few questions
- A daily hunt for fresh posts, seed rounds and community job threads
- Checking post freshness, contact research and confidence labels
- A Today list, a leads board, follow-up reminders and a draft checker
- Run reports, import and export, and compatibility with the agent skill's files

**Later**
- Desktop app for Windows, macOS and Linux, with true background scheduling and OS secure key storage
- Stats, more regions, translations

**Out of scope**
- Writing, sending or scheduling outreach emails, or connecting to the user's mailbox
- Auto-applying, filling job forms or ATS applications
- Any scraping that needs a login, browser extensions that read LinkedIn, buying contact data
- Our own backend: no accounts, no sync service, no proxy server
- Mobile-specific apps (the web app must still work on phones)

## 6. Functional requirements

Priority: **P0** = MVP must-have, **P1** = v1, **P2** = later.

### 6.1 First visit

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | The app opens from one URL in current Chrome, Edge, Firefox and Safari, with nothing to install. | P0 |
| FR-1.2 | The first-run wizard explains in 3 short screens what the app does, what it won't do (rules in §4), what it costs (see FR-4.13), and that data stays in this browser. | P0 |
| FR-1.3 | The user can install it as an app (PWA) and open it from the home screen or desktop. Saved data can be viewed offline. | P1 |
| FR-1.4 | A "Try with sample data" mode lets people explore before adding a key. Sample leads are clearly labelled as samples. | P1 |
| FR-1.5 | Show a clear notice that data lives in this browser on this device: clearing browser data deletes it, and a backup export is one click away. | P0 |

### 6.2 Providers

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | **Several AI providers.** v1 ships adapters for at least 3 providers, chosen from those that pass FR-2.2. The candidates are Anthropic (Claude), OpenAI, Google (Gemini) and OpenRouter. | P0 |
| FR-2.2 | **A provider is supported only if it passes 3 checks:** (a) it accepts API calls straight from a browser (CORS) with the user's own key; (b) it offers tool use or structured output good enough to return lead data as JSON; (c) it has a built-in web search tool, or it's paired with a search provider. The provider list shows which checks each one passes. | P0 |
| FR-2.3 | **Search: both options.** By default, the hunt uses the AI provider's built-in web search and web fetch. As an option, the user adds a Firecrawl key: then searches with date filters (past day, past week) and page reading go through Firecrawl, if it passes the browser check in FR-2.2(a). | P0 |
| FR-2.4 | A guided key screen for each provider: where to get a key, a test button, and a plain-language error if the key or a needed capability fails. | P0 |
| FR-2.5 | Pick a model per provider, with a recommended default and a note on cost and quality. | P1 |
| FR-2.6 | Providers are adapters with one shared interface (search, fetch a page, return structured leads, report cost). Adding a provider never changes the hunt logic. | P0 |
| FR-2.7 | If a provider fails during a run, offer to retry with another configured provider, without losing what was found so far. | P2 |

### 6.3 Profile

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Build the profile from any of: an uploaded CV (PDF or DOCX, read in the browser), a LinkedIn "Save to PDF" export, a portfolio URL, or answers to 5 questions (roles, skills, location and remote, pay floor, proof links). | P0 |
| FR-3.2 | Show the drafted profile for review before saving. Every fact taken from a document is editable. Nothing is saved until the user confirms. | P0 |
| FR-3.3 | Fields: target roles; skills; location; time zone; remote preference; pay floor; relocation rules (minimum pay, visa needs); preferred domains; stages; roles and companies to skip; proof links with one line each; background facts used for hooks. | P0 |
| FR-3.4 | Offer examples next to every field, such as domain chips ("AI dev tools", "fintech", "design tools") the user can tap. | P1 |
| FR-3.5 | Store the profile in the agent skill's `profile.md` format (see §6.9). | P0 |
| FR-3.6 | Warn before a hunt if required fields are empty (roles, skills, location, floor). | P0 |
| FR-3.7 | Building a profile from a CV or LinkedIn PDF sends the file's text to the user's AI provider. Ask first, and name the provider. If the user says no, offer the 5 questions instead. | P0 |

### 6.4 The hunt

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | One big **Run today's hunt** button. | P0 |
| FR-4.2 | **Run on open:** a setting that starts the hunt when the app is opened and today's hunt hasn't run yet. The web app can't run while closed. Real scheduling comes with the desktop app. | P1 |
| FR-4.3 | **Fresh posts:** search public LinkedIn and X hiring posts from the last 24 hours that match the profile's roles and skills. | P0 |
| FR-4.4 | **Freshness check:** for LinkedIn and X posts, read the publish time from the post ID in the URL. This runs in the browser, with no network or login. Drop posts older than 24 hours. Other sites need a date printed on the page, or the post is labelled "age unknown" and listed last. | P0 |
| FR-4.5 | **Likes:** read the reaction count from the public page through the fetch provider. If it can't be seen, show "unknown". Drop posts with 100 or more. | P0 |
| FR-4.6 | **Seed rounds:** find pre-seed and seed rounds announced in the last 14 days (news sites, YC launches, founders' own posts). Confirm the date at the original source. List Series A and later separately, as lower priority. | P0 |
| FR-4.7 | **Community job threads:** include the current month's Hacker News "Who is hiring?" thread, filtered to the profile. (Raised to P0: it gave 6 of the 14 leads in the first live hunt, see Appendix A.) | P0 |
| FR-4.8 | **Fit filter:** apply the hard filters in §9.1 and drop what fails, with its reason code. Each kept lead shows a one-line reason it fits. Dropped leads appear under "Dropped, and why". | P0 |
| FR-4.9 | **Recruiter filter:** detect and drop agency or recruiter posts and anonymous gig listings, and explain why. | P1 |
| FR-4.10 | Progress shows in plain steps ("Searching LinkedIn posts…", "Checking 14 posts are under a day old…"). The user can cancel, and the app keeps whatever it already found. | P0 |
| FR-4.11 | Handle rate limits by pacing requests and retrying with backoff. Retries must not fire all at once, because rejected requests can count against the limit too. A source that keeps failing is listed under "Couldn't search today", and the rest of the run still finishes. | P0 |
| FR-4.12 | **Sources are plug-ins.** Each source (LinkedIn posts, X posts, funding news, HN, YC, regional news) is a separate module that can be switched on or off. Contributors can add one without changing the core. | P1 |
| FR-4.13 | **Cost control:** show the estimated cost before each run and the actual cost after it, per provider. The user sets a monthly spending cap, and runs stop at the cap. Price tables live in one file in the repo, with the date they were last checked. | P0 |
| FR-4.14 | Target about 20 people per day: roughly 6–8 posts and 4–6 funded startups with up to 3 people each. The target is adjustable. | P1 |
| FR-4.15 | Keep the tab awake during a run, and warn before the tab is closed mid-run. If a run is interrupted, offer to resume or discard it next time. | P1 |
| FR-4.16 | **Merge signals:** when a fresh post, a funding round and a community opening point to the same company (same site or mail domain) in one run, show one lead that lists every source. | P0 |
| FR-4.17 | **Hiring posts by others:** a post by an investor or an employee saying a company is hiring counts as a fresh post for that company. The poster is listed as the source, and contacts come from the company itself, never from the investor. | P1 |
| FR-4.18 | **Unverifiable companies:** drop a lead when no public source confirms that the company exists and that the round or role is real (for example, when the only source is a paywalled note). | P0 |
| FR-4.19 | **Signals:** every kept lead carries the soft signals from §9.2 (pay unknown, relocation, seniority stretch and so on) as visible tags. | P0 |
| FR-4.20 | **Hooks:** 1–3 per lead. Each is a checkable fact with a source link, and at least one ties to a specific item in the user's profile (a proof link or a background fact). | P0 |
| FR-4.21 | **Exact links:** community-thread openings link to the exact comment, not the whole thread, so each opening has its own source URL. | P0 |

### 6.5 People and contacts

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | For posts: the person who posted, then one founder. For funded startups: up to 3 people, founders first, then the lead closest to the user's role. | P0 |
| FR-5.2 | Contact sources are limited to public, professional ones: the post itself, the company site (team, careers, contact, legal or imprint pages), the person's own site, a public GitHub profile, YC pages, and community job threads. | P0 |
| FR-5.3 | Every email address carries one label: **Published** (written on a public page, with the link), **Pattern** (built from an address format the company uses publicly, with the example shown), or **Guess** (no evidence). | P0 |
| FR-5.4 | Build Pattern and Guess addresses on the company's mail domain, which can differ from its website domain. In the first live hunt, one company's site was `.ai` but its published address was `.com`. (Raised to P0.) | P0 |
| FR-5.5 | Show "Verify before sending" next to Pattern and Guess addresses, with a link to explain why. | P0 |
| FR-5.6 | If a post asks for a DM, a form or an apply link, show the best email found first (the method says to email even then) and the requested method second, labelled "What the post asked for". If no email is found, show the requested method only. A guessed address is always labelled Guess. | P0 |
| FR-5.7 | **Do-not-contact list:** the user can block a person, an email address or a whole domain (for example after "please don't contact me"). Blocked entries never appear again, in any run. | P0 |
| FR-5.8 | **Personal addresses:** personal-domain emails (gmail.com, outlook.com and so on) are shown only when the person published them for work contact on their own page. They're labelled Published, with the evidence, and never guessed. | P0 |

### 6.6 Today's list and the leads board

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | **Today** is the home screen: the people to email today and the follow-ups due, in the order set by §9.4. It answers one question: "who do I write to now?" | P0 |
| FR-6.2 | Each lead card shows: company, what they do (one line), role, freshness or round date, likes, fit reason, people and contacts with labels, hooks, and source links. | P0 |
| FR-6.3 | **Board view** with columns New → Emailed → Replied → Call → Offer, plus Not now and Skip. Cards move by drag-and-drop or by keyboard. | P0 |
| FR-6.4 | **Mark as emailed** records the date for that person and schedules follow-ups by the rules in §8. | P0 |
| FR-6.5 | Contact actions: copy address, and open the user's own email app (`mailto:`) with only the address and a blank subject. Never add body text. | P0 |
| FR-6.6 | Search and filter by status, type (post or funding), domain, location, date and label. | P1 |
| FR-6.7 | Personal notes on each lead. | P1 |
| FR-6.8 | No duplicates: the lead key in §11.2 is never added twice, and re-adding follows the rules in §8.3. | P0 |
| FR-6.9 | Simple stats: emails sent this week, reply rate, calls booked, and the sources that led to replies. | P2 |
| FR-6.10 | **Per-person tracking:** "Mark as emailed" applies to one person, not the whole lead, because a funding lead can have 3 people. The card shows progress, for example "2 of 3 emailed". | P0 |
| FR-6.11 | **Daily counter:** Today shows "N of 20 emailed today" (using the daily target). It resets at local midnight. | P0 |
| FR-6.12 | **Not now:** asks for a return date (default 30 days). See §8.2. | P1 |
| FR-6.13 | **Undo:** every status change can be undone for 10 seconds. | P1 |
| FR-6.14 | **Small screens:** under 768px wide, the Board becomes a list grouped by status, with a "Move to…" menu instead of drag-and-drop. | P0 |

### 6.7 Draft checker

| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | The user pastes their own draft and gets a pass or fail on 6 checks: 5 lines or fewer; the first line is about them; one concrete proof link; one small ask; no stock openers; the subject names the role or the hook. | P1 |
| FR-7.2 | Show only problems, with the line they're on. Never rewrite the draft, and never offer "improved" text. | P1 |
| FR-7.3 | The length and stock-opener checks run offline. Checks that need judgement use the AI key and say so. | P2 |

### 6.8 Reports and history

| ID | Requirement | Priority |
|---|---|---|
| FR-8.1 | Each run saves a report (`runs/YYYY-MM-DD.md`) with: kept leads, dropped leads and why, searches that found nothing, failed sources, provider used, and cost. | P0 |
| FR-8.2 | A history screen lists past runs with counts and cost. | P1 |

### 6.9 Data, storage and compatibility

| ID | Requirement | Priority |
|---|---|---|
| FR-9.1 | **Default storage** is the browser's own storage (IndexedDB). The app asks the browser to keep it persistent, so it isn't cleared under storage pressure, and shows whether that was granted. | P0 |
| FR-9.2 | **Backup:** export everything as one ZIP of skill-compatible files: `profile.md`, `leads.csv` (the skill's 17 columns, same order), `runs/`, plus an app file for extras. Import a ZIP. After 7 days without a backup, show a gentle reminder. | P0 |
| FR-9.3 | **Link a folder** (in browsers that allow it): read and write a real folder on disk in the skill's format, so the web app and the agent skill share one hunt folder. Other browsers use import and export. | P1 |
| FR-9.4 | Extras that `leads.csv` can't hold (status history, notes, cost) go in an app-only file next to it, so the skill keeps working. | P0 |
| FR-9.5 | "Delete a person" removes that person's name and contacts everywhere, but keeps the company lead. "Delete everything" wipes all app data and keys after a typed confirmation. | P0 |
| FR-9.6 | No sync between devices in v1. Moving to another device means export, then import. | P0 |
| FR-9.7 | **Retention:** apply the rules in §13.2 automatically. | P1 |

### 6.10 Settings

| ID | Requirement | Priority |
|---|---|---|
| FR-10.1 | Providers and keys (§6.2), each with a test button and a remove button. | P0 |
| FR-10.2 | Daily target, follow-up delay, monthly spending cap, run on open. | P0 |
| FR-10.3 | Turn sources on or off, and pick a region for funding news. | P1 |
| FR-10.4 | Optional passphrase that encrypts stored keys in the browser. The passphrase is asked once per session. | P1 |
| FR-10.5 | Light, dark and system theme. Text size. | P1 |

## 7. Acceptance criteria (P0)

Each P0 requirement is done when its criteria pass. "Fixture" means a saved copy of a real page or response that the tests run against, so they don't depend on the live web.

### 7.1 First visit and providers

- **AC-1.1** Opening https://get-me-hired.netlify.app in the latest 2 versions of Chrome, Edge, Firefox and Safari (desktop, Android, iOS) shows the welcome screen with no console errors. Until the user adds a key or opens sample data, the only network requests are for the app's own files.
- **AC-1.2** The welcome flow shows all 3 screens before the first hunt. The "What it won't do" screen lists the never-rules from §4: no outreach writing or sending, no login scraping, no leaked data, no mail-server probing.
- **AC-1.5** The storage notice shows on first visit and in Settings → Data. It names the current browser and says whether persistent storage was granted.
- **AC-2.1 / AC-2.2** The provider picker lists only providers that pass the browser-call check. Each listed provider shows its results for the other two checks (structured output, and web search built in or paired).
- **AC-2.3** With no Firecrawl key, a hunt completes using only the AI provider's tools. With a valid Firecrawl key, the run report names Firecrawl as the search provider, and post and funding searches use the past-day and past-week filters.
- **AC-2.4** The test button shows "Connected" within 10 seconds for a valid key. Failures show a plain-language message naming the cause (wrong key, no credit, rate limited, provider down, missing capability), never a raw error dump.
- **AC-2.6** Every adapter passes the same shared contract test suite (search, fetch, structured lead output, cost report) against recorded fixtures.

### 7.2 Profile

- **AC-3.1** A text-based PDF or DOCX CV up to 10 MB fills in at least roles, skills and location. An image-only (scanned) PDF shows "We couldn't read text from this file" and offers the 5 questions.
- **AC-3.2** Nothing is written to storage before "Save profile". Leaving the page with unsaved changes shows a warning.
- **AC-3.3** The profile form has every field in FR-3.3. Saving, exporting and re-importing gives back every field unchanged.
- **AC-3.5** An exported `profile.md` uses the agent skill's headings: Five questions, Prefer, Skip, Visa / constraints, Background.
- **AC-3.6** With a required field empty, the hunt button is disabled, and the message names the missing fields.
- **AC-3.7** No CV text leaves the browser before the user agrees. The consent prompt names the provider.

### 7.3 The hunt

- **AC-4.1** One click starts a hunt from Today. A second click while a hunt is running does nothing.
- **AC-4.3 / AC-4.4** For a LinkedIn URL containing `activity-<id>`, `ugcPost-<id>`, `share-<id>` or `urn:li:activity:<id>`, the publish time is `id >> 22` milliseconds since the Unix epoch. For an X status URL it's `(id >> 22) + 1288834974657`. Fixture: `x.com/elonmusk/status/1585841080431321088` decodes to `2022-10-28T03:49:11.734Z`. A post more than 24.0 hours old at check time never appears in Today or in the report's kept list.
- **AC-4.5** `likes` is an integer read from the page, `unknown`, or `n/a` (the source has no likes, such as HN). A post with 100 or more reactions is dropped with code `too-popular`.
- **AC-4.6** Every funding lead shows an announcement date at most 14 days before the run, with a link to a source dated that day. A round seen only on a list or tracker page needs the company's own announcement or a second dated source. Otherwise it's dropped with code `stale` or `unverifiable`. Fixture: a "full list of 2026 rounds" page that includes a March round must produce no lead in November.
- **AC-4.7** The current month's HN thread is found automatically. Each kept opening links to its comment (FR-4.21).
- **AC-4.8** Every kept lead has a fit line of at most 140 characters that names at least one profile item. Every dropped lead appears under "Dropped, and why" with exactly one reason code from §9.1.
- **AC-4.10** The progress panel shows the current step in words, with counts. Cancel stops new requests within 5 seconds, and the partial results are saved as a run marked "Cancelled".
- **AC-4.11** After a rate-limit response, the next request to that provider waits at least its retry-after time (or 10 seconds if none is given), and requests are never retried all at once. A source that fails 3 times is listed under "Couldn't search today", and the run still writes a report.
- **AC-4.13** The estimate appears before every run. A run that would go past the remaining monthly cap doesn't start. A run that reaches the cap partway stops, saves its results, and says so.
- **AC-4.16** A post and a funding round for the same domain in one run produce exactly one lead, listing both sources.
- **AC-4.18 / AC-4.19 / AC-4.20** Every kept lead has at least one confirming source, its soft-signal tags, and 1–3 hooks. Each hook has a link, and at least one hook references a profile item.
- **AC-4.21** No two leads share a source URL.

### 7.4 Contacts

- **AC-5.1** A funding lead has at most 3 people. A post lead lists the poster first, unless the poster is an investor (FR-4.17).
- **AC-5.2** Every contact's evidence URL is one of the allowed source types. No hunt request carries the user's LinkedIn or X login cookies.
- **AC-5.3** Every email address has exactly one label. **Published:** the address string appears in the fetched text of its evidence URL (checked automatically). **Pattern:** an example address on the same mail domain is shown. Anything else is **Guess**.
- **AC-5.4** Pattern and Guess addresses use the mail domain of the evidence address when one exists.
- **AC-5.5** Every Pattern and Guess address shows "Verify before sending".
- **AC-5.6** A post asking for a DM shows the found email first and "What the post asked for: DM" second.
- **AC-5.7** After blocking a domain, a fixture hunt that finds that domain shows it only under "Dropped" with code `do-not-contact`.
- **AC-5.8** No address on a personal mail domain is ever labelled Pattern or Guess.

### 7.5 Today and Board

- **AC-6.1** Today's order matches §9.4 on a fixture set of 30 leads (a snapshot test).
- **AC-6.2** A fixture lead's card shows every field in FR-6.2. Empty fields show "unknown", never a blank gap (a snapshot test).
- **AC-6.4** A person marked emailed on Monday 2026-11-16 has follow-up 1 due Monday 2026-11-23. If follow-up 1 is sent that day, follow-up 2 is due Wednesday 2026-12-02. If nothing changes 7 working days after follow-up 2 is sent, the lead becomes `no-reply`.
- **AC-6.3** Every board move can be done by keyboard. A screen reader announces the new column.
- **AC-6.5** The email link is exactly `mailto:<address>`, with no subject or body parameters.
- **AC-6.8** Adding a lead whose key already exists changes nothing. A new signal for a known company attaches to the existing lead (§8.3).
- **AC-6.10 / AC-6.11** Marking one of 3 people emailed shows "1 of 3 emailed" on the card and adds 1 to today's counter.
- **AC-6.14** At 360px wide, every status change works without drag-and-drop.

### 7.6 Reports, data and settings

- **AC-8.1** Every run (completed, cancelled or failed) writes a report with these sections: kept, dropped and why, dry searches, failed sources, provider, cost.
- **AC-9.1** Persistent storage is requested on the first save. The result is shown in Settings → Data.
- **AC-9.2** Export, then import into a fresh browser profile, reproduces the same leads, people, statuses, notes, profile and history (a round-trip test). The exported `leads.csv` header matches §11.2 exactly.
- **AC-9.4** Opening a folder written by the agent skill (fixture) shows its leads without changes to `leads.csv`.
- **AC-9.5** After "Delete a person", a search of all stored data, including run reports, finds neither the name nor the address.
- **AC-9.6** The app makes no requests to any sync or cloud-storage service.
- **AC-10.1** "Remove key" deletes the key from storage immediately.
- **AC-10.2** Settings survive a reload.

## 8. Lead lifecycle and follow-ups

### 8.1 Statuses

| Status | Meaning | Set by |
|---|---|---|
| `new` | Found, nobody emailed yet | Hunt |
| `emailed` | At least one person emailed | User |
| `replied` | Someone answered | User |
| `call` | A call or interview is booked | User |
| `offer` | An offer arrived | User |
| `not-now` | Parked until a return date | User |
| `no-reply` | All follow-ups sent, no answer | App, automatically (§8.2) |
| `rejected` | They said no | User |
| `skip` | The user decided not to pursue it | User |

The agent skill's statuses (`new`, `emailed`, `replied`, `call`, `no-reply`, `rejected`, `skip`) are a subset of these. The skill needs `offer` and `not-now` added (§11.5).

### 8.2 Rules

1. **Email dates are tracked per person, status per lead.** The lead becomes `emailed` when its first person is marked emailed.
2. **Follow-up cadence:** follow-up 1 is due 5 working days after the first email. Follow-up 2 is due 7 working days after follow-up 1. If nothing changes 7 working days after follow-up 2, the lead moves to `no-reply` and leaves Today. A working day is Monday to Friday in the user's time zone. The delays (3–10 days) and the number of follow-ups (0–3) are adjustable.
3. **A reply stops follow-ups.** Marking a lead `replied`, `call`, `offer` or `rejected` cancels pending follow-ups.
4. **Not now** asks for a return date (default 30 days). On that date, the lead comes back to Today under "Back from Not now" with its earlier status.
5. **Any manual move is allowed**, including backwards. Every change is logged with its date, and each can be undone for 10 seconds.
6. **The app moves a lead on its own only for** `emailed` → `no-reply` (rule 2) and `not-now` → its earlier status (rule 4).

### 8.3 Re-adding companies

- A company (by site or mail domain) with a lead found in the last 30 days is not added again. A new signal, such as a new post or a new round, attaches to the existing lead and puts it in Today under "New signal".
- A company marked `skip` or `rejected` stays hidden for 180 days, unless it announces a new funding round.
- A blocked entry (FR-5.7) never comes back.

## 9. Fit, tiers and ranking

### 9.1 Hard filters (drop, with a reason code)

| Code | Drop when |
|---|---|
| `stale` | A post is over 24 hours old, or a round is over 14 days old or its date can't be confirmed |
| `too-popular` | A post has 100 or more reactions |
| `recruiter` | Posted by an agency or recruiter not employed by the company, or an anonymous gig listing (for example "AI training project, 300 openings, company not named") |
| `role-mismatch` | Different role family, even if the title matches. Example: a mechanical, RF or civil "design engineer" for a software design engineer profile |
| `location` | On-site, or remote limited to regions that exclude the user's country, with no relocation path the profile accepts |
| `pay-below-floor` | Stated pay below the remote floor, or below the relocation minimum for a relocation role |
| `skip-list` | Matches a company or role the profile says to skip |
| `do-not-contact` | Matches the block list |
| `duplicate` | Its lead key already exists (§8.3) |
| `unverifiable` | No public source confirms the company, the role or the round |

**Region rules for "remote":** "Remote (worldwide / anywhere)" passes. "Remote (US)" or "Remote (Europe)" fails `location` for a user outside that region, unless the post accepts the user's time zone overlap (for example "CET hours") or the user has work rights there. "Remote (anywhere, EST hours)" passes with the `timezone` signal.

### 9.2 Soft signals (keep, shown as tags, affect tier)

| Signal | When |
|---|---|
| `pay-unknown` | No pay stated |
| `relocation` | The role needs a move, and the pay is at or above the relocation minimum or unknown |
| `visa-unknown` | Relocation is needed and visa sponsorship isn't stated |
| `seniority-stretch` | Staff, Principal or Lead title, or more years required than the profile shows |
| `outside-domains` | The company's domain isn't in the profile's preferred domains |
| `no-open-role` | A funding lead with no listed role |
| `equity-only` | Unfunded, or pay is equity only |
| `timezone` | Remote, but tied to a time zone far from the user's |
| `guess-only` | Every email address for the lead is a Guess |
| `dm-or-form` | The post asks for a DM, form or apply link |

### 9.3 Tiers

- **A:** no more than 1 soft signal (not counting `no-open-role` on funding leads), and at least one Published or Pattern address.
- **B:** 2–3 soft signals, or `guess-only`.
- **C:** 4 or more soft signals, or `equity-only`.

### 9.4 Today's order

1. Follow-ups due, oldest first
2. "New signal" and "Back from Not now" leads
3. New fresh posts, tier A → C, youngest first (posts lose value within hours)
4. New funding leads, tier A → C, newest round first
5. New community-thread openings, tier A → C, newest comment first

The list stops when the people listed reach the daily target. It counts people, not leads, because one funding lead can hold 3 people. Each card shows one line on why it's in that position, for example "Fresh post, 4h old, tier A".

## 10. Screens and states

### 10.1 Screens

| Screen | Purpose | Main parts |
|---|---|---|
| Welcome | First visit | 3 short steps: what it does, what it won't do, cost and storage |
| Connect a provider | Keys | Provider list with check results, key field, test, where to get a key, shared-computer warning |
| Your profile | Build and edit the profile | Source choice (CV, LinkedIn PDF, URL, questions), review form, example chips |
| Today | Home | Daily counter, ranked list, "Run today's hunt" with estimate, follow-ups due |
| Board | Pipeline | Status columns (a list on phones), filters, search |
| Lead detail | One lead, as a side panel | What they do, signals, sources, people and labelled contacts, hooks, notes, history, block |
| Hunt | A run in progress | Plain steps with counts, live count of kept and dropped, cancel |
| Run report | After a run | Kept, dropped and why, dry searches, failed sources, provider, cost |
| History | Past runs | Date, counts, cost, cancelled or failed marker |
| Draft checker | Check the user's own email | Paste box, 6 checks, problems by line, no rewrite |
| Settings | Preferences | Providers, target, cadence, cap, run on open, sources, region, theme, passphrase, advanced limits (§12) |
| Data and backup | Storage | Storage status, export, import, link a folder, retention, block list, delete a person, delete everything |

### 10.2 States

| State | What the user sees | Action offered |
|---|---|---|
| No profile yet | Today: "Let's set up your profile first." | Set up profile |
| Profile ready, never hunted | "Run your first hunt", with the estimate | Run |
| Hunt found nothing new | "Nothing new today." The sources that came back empty, and ideas: widen roles or domains, add Firecrawl, try tomorrow. Never sample or invented leads. | Edit profile, add Firecrawl |
| Today all done | "You're done for today: N emailed, M follow-ups sent." | View Board |
| Key wrong or expired | "This key didn't work with <provider>." | Fix key |
| No credit with provider | "Your <provider> account is out of credit." | Open provider billing page |
| Provider lacks a needed capability | "<provider> can't search the web from here. Add a Firecrawl key or pick another provider." | Add key, switch |
| Rate limited | "Slowing down: <provider> asked us to wait." A countdown. | Wait (automatic) |
| Provider down | "<provider> isn't answering. Your results so far are saved." | Retry, switch provider |
| Spending cap reached | "You've reached this month's cap of $X." | Raise cap, wait for next month |
| Storage not persistent | A banner: "This browser may delete your data when space runs low." | Install app, export backup |
| Storage full | "This browser is out of space for Get Me Hired." | Export, apply retention, delete old runs |
| Offline | "You're offline. You can read and update leads, but hunts need a connection." | None |
| Closing the tab during a hunt | The browser's "Leave site?" prompt | Stay |
| Interrupted hunt found on open | "Your last hunt stopped partway." | Resume, discard |
| Import file invalid | "This file isn't a Get Me Hired backup." The reason. | Choose another file |
| Import from a newer version | "This backup is from a newer version. Update the app first." | None |
| Safari without install | "Safari may delete data for sites you don't visit for 7 days. Add Get Me Hired to your Dock or Home Screen, or back up weekly." | How to install, export |

## 11. Data format

### 11.1 Files

A hunt folder, or a backup ZIP, contains:

- `profile.md`: the profile (the skill's format)
- `leads.csv`: one row per lead (§11.2)
- `runs/YYYY-MM-DD.md`: one report per run. A second run on the same day writes `YYYY-MM-DD-2.md`, and so on.
- `get-me-hired.json`: the format version, plus everything the CSV can't hold (§11.3)

Keys are never written to any of these files.

### 11.2 `leads.csv`

- Header (exact, in this order): `found_on,type,company,company_url,source_url,posted_at,age_hours,likes,round,role,fit,people,contacts,contact_confidence,hooks,status,next_action_on`
- Encoding UTF-8 without a BOM, LF line endings, RFC 4180 quoting. "Export for Excel" writes a separate copy with a BOM.
- A list inside a field is separated by `; ` (semicolon and space).

| Column | Format |
|---|---|
| `found_on` | `YYYY-MM-DD`, the user's local date |
| `type` | `post` or `funding`. Community-thread openings are `post`. |
| `company` | Text |
| `company_url` | Absolute `https` URL, or empty |
| `source_url` | Absolute URL of the exact post, comment or article |
| `posted_at` | ISO 8601 date or UTC date-time. A `~` prefix means approximate (for example "~2026-11-03" from "11 days ago"). |
| `age_hours` | Number with 1 decimal, measured when found. A `~` prefix means approximate. Empty if unknown. |
| `likes` | Integer, `unknown` or `n/a` |
| `round` | For example "$4M pre-seed (lead investor)", or empty |
| `role` | Text |
| `fit` | One line, at most 140 characters |
| `people` | List of `Name (Role)` |
| `contacts` | List. Each item is an email, `DM: <where>`, `form: <url>` or `apply: <url>`. |
| `contact_confidence` | List, item-for-item with `contacts`: `published (<evidence>)`, `pattern (from <example>)`, `guess`, or `method` for non-email items |
| `hooks` | List |
| `status` | A value from §8.1 |
| `next_action_on` | `YYYY-MM-DD`, or empty |

**Lead key:** the normalised `source_url` plus `|` plus the lowercased company name. To normalise a URL: lowercase the scheme and host, drop `www.`, drop the fragment, drop the query except where it identifies the item (HN `?id=`), drop any trailing slash, and treat `twitter.com` as `x.com`. The original URL is stored unchanged. The key is used only for comparing.

**Lenient import:** rows written by older versions of the skill may share a thread URL across several companies, or have `contacts` and `contact_confidence` lists of different lengths. The import still loads them. Rows with mismatched lists are marked "Needs review", and the raw text is kept.

### 11.3 `get-me-hired.json`

```json
{
  "format_version": 1,
  "app_version": "0.1.0",
  "leads": {
    "<lead key>": {
      "people": [
        {
          "name": "…", "role": "…",
          "contacts": [{ "method": "email", "value": "…", "label": "published", "evidence": "https://…" }],
          "emailed_on": ["2026-11-15"],
          "followups_sent": ["2026-11-22"]
        }
      ],
      "sources": [{ "kind": "post", "url": "https://…", "seen": "2026-11-14" }],
      "signals": ["pay-unknown", "relocation"],
      "tier": "A",
      "status_history": [{ "status": "new", "at": "2026-11-14T18:02:00Z" }],
      "snooze_until": null,
      "notes": ""
    }
  },
  "runs": [{ "date": "2026-11-14", "provider": "…", "searches": 18, "fetches": 35, "kept": 14, "dropped": 19, "cost_usd": 0.0, "status": "completed" }],
  "do_not_contact": ["person@example.com", "example.org"]
}
```

- `leads.csv` wins for its 17 columns. If the CSV was edited outside the app (for example by the skill), the app reloads it and keeps the JSON extras that still match a key.
- JSON entries whose key no longer exists in the CSV are kept for 30 days, listed under Data and backup, then removed.

### 11.4 Versioning

- `format_version` is an integer. The app reads its own version and every older one, and migrates forward on import after saving a backup copy.
- A newer `format_version` than the app knows is refused with the "Update the app first" state.
- The CSV header changes only together with a `format_version` bump.

### 11.5 Changes needed in the agent skill

To keep both tools in step, the skill needs these changes. Track them as one issue in the skill's repo.

1. Add the `offer` and `not-now` statuses.
2. Link community-thread openings to the exact comment.
3. Write `contacts` and `contact_confidence` as item-for-item lists, using `method` for DM, form and apply items.
4. Use the `~` prefix for approximate dates and ages.
5. Add the run report sections the app writes after the skill's 4 (Fresh posts, Just raised, Follow-ups due, Dry queries): "Community threads", "Dropped, and why", "Couldn't search today", "Not searched", and "Provider and cost". Write "checked from the URL" only when the age was decoded from the URL, and mark facts a provider read as "Read by <provider> from the linked page. Not checked by the app."

## 12. Hunt limits per run

These are the defaults. Advanced users can change them in Settings.

| Limit | Default |
|---|---|
| Web searches | 40 |
| Page reads | 60 |
| People researched | 1.5 × the daily target |
| Running time | 15 minutes |
| Parallel requests per provider | 4 (Firecrawl: paced to its plan's per-minute limit) |

- **Stage order:** fresh posts first (they lose value fastest), then funding, then community threads, then contacts and hooks for the kept leads.
- **Budget split:** posts 30%, funding 35%, community 10%, contacts and hooks 25%. Budget a stage doesn't use passes to the next stage.
- **When a limit is reached:** start no new work, finish the requests in flight, save, and name the limit in the report.

## 13. Privacy and other people's data

### 13.1 What's stored about the people in leads

The founders and posters in a lead never signed up for this app. Store only their name, work role, work contact (with its label), one public profile or source link, and the source the lead came from. Never store photos, phone numbers, home addresses or extra social accounts, and never guess personal-domain addresses (FR-5.8).

### 13.2 Retention

- People and contacts on leads in `skip`, `rejected` or `no-reply` are removed automatically after 180 days (adjustable from 30 to 365). The company row and its outcome stay, with the people replaced by "(removed)".
- Run reports older than 180 days are deleted. Their counts stay in History.
- The block list (FR-5.7) is kept until the user removes an entry.

### 13.3 What goes to providers

The profile text, search queries and the text of fetched pages go to the user's AI or search provider during a hunt. The CV goes only with consent (FR-3.7). Both the welcome screen and Settings say this.

### 13.4 The user's responsibility

The welcome screen and the Data screen show: "You decide how to use these contact details. Follow the laws where you and they live, for example GDPR in Europe." The app helps by keeping only the minimum (§13.1), deleting automatically (§13.2), and making one-click removal easy (FR-9.5, FR-5.7).

## 14. Browser support

| Browser (latest 2 versions) | Works | Link a folder | Install as app | Storage note |
|---|---|---|---|---|
| Chrome, Edge (desktop) | Yes | Yes | Yes | Persistent storage is usually granted, especially once installed |
| Chrome (Android) | Yes | No, use ZIP | Yes | Same as above |
| Firefox (desktop, Android) | Yes | No, use ZIP | Limited | Asks the user before making storage persistent |
| Safari (macOS, iOS) | Yes | No, use ZIP | Add to Dock or Home Screen | Data of sites not visited for 7 days may be deleted, unless the app is installed. Show the Safari warning (§10.2). |

## 15. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Accessibility:** WCAG 2.2 AA. Every action works by keyboard, focus is always visible, screen-reader labels are on all controls, and motion turns off when the system asks for reduced motion. |
| NFR-2 | **Privacy:** no analytics, no third-party scripts, no fonts or CDNs loaded from other sites. The only network requests go to the providers the user configured. |
| NFR-3 | **Security, keys:** keys never leave the browser except in requests to their own provider. Optional encryption at rest (FR-10.4). The app is served from **its own origin**, `get-me-hired.netlify.app` (D6), never a path on a host other apps share, since browser storage is per origin. A strict Content Security Policy, sent as an HTTP header from Netlify's headers config, allows requests only to known provider domains. |
| NFR-4 | **Security, content:** fetched web pages are shown as text, never as live HTML, and treated as untrusted. Instructions found inside a page are ignored by the hunt logic. |
| NFR-5 | **Static hosting on Netlify:** the whole app builds to static files, with no server code and no Netlify Functions. Netlify builds from the GitHub repo: every push to `main` deploys to production, and every pull request gets a Deploy Preview link, so contributors and reviewers can try changes before merging. Build settings, security headers and SPA redirects live in `netlify.toml` in the repo. |
| NFR-6 | **Performance:** first load under 3 seconds on a mid-range laptop on 4G. Today and Board stay smooth with 5,000 leads. A typical hunt finishes in under 10 minutes (the hard limit is in §12). |
| NFR-7 | **Reliability:** an interrupted run or a closed tab never corrupts stored data. Writes are all-or-nothing. |
| NFR-8 | **Responsive:** every screen works from 360px wide (phone) up to desktop (see FR-6.14). |
| NFR-9 | **Language:** plain English, at about an 8th-grade reading level, with no unexplained jargon. All interface text sits in one file, ready for translation later. |
| NFR-10 | **Cost transparency:** a typical daily run should cost less than a cup of coffee with the recommended defaults. The exact target will be set after the spike measures real runs. |
| NFR-11 | **Ethics:** the rules in §4 are enforced in code, not only in documentation. There's no setting to turn on login scraping, mail-server probing or auto-sending. |
| NFR-12 | **Portable core:** the hunt logic, provider adapters and data format live in modules with no browser-only dependencies, so the later desktop app reuses them. |
| NFR-13 | **Testable:** the post-age decoder, the CSV reader and writer, the ranking (§9) and the lifecycle (§8) have unit tests. The adapters have contract tests. Hunt logic runs against recorded fixtures with no network. CI runs all of them on every pull request. |

## 16. Success measures

| Measure | Target | How it's measured |
|---|---|---|
| Time to first hunt | Under 10 minutes, with no help | Moderated sessions with 5 non-technical testers before each minor release. Record the time and every point where a tester got stuck. |
| Fresh posts are fresh | 100% under 24 hours | Unit tests (AC-4.4), plus a runtime guard that refuses to show a post with no checked age under 24 hours |
| Every address labelled | 100% | Runtime guard plus tests (AC-5.3) |
| Providers supported | At least 3 at v1 | Spike results, plus contract tests in CI |
| Contact quality | Report the share of Published + Pattern addresses per run (8 of 18 in the first live hunt) and aim to raise it | Run reports |
| Outcome | Calls within about two weeks of sending around 20 emails a day | Local stats only. After 14 days of use, an optional, anonymous survey link. No telemetry. |

## 17. Release plan

| Release | Contents |
|---|---|
| **Spike (before MVP)** | Test FR-2.2 against each candidate provider and Firecrawl: browser calls, structured output, built-in search and fetch. Measure the cost and yield of one real hunt per provider, using the limits in §12. Build the shared core first: the post-age decoder, the CSV reader and writer, and the lead key. The results decide the v1 provider list and the default. |
| **MVP (v0.1)** | All P0: web app on Netlify, at least 2 providers, profile from questions and CV, hunt (posts, funding, HN, freshness, merge, contacts, labels, hooks, cost cap), §8 lifecycle, §9 ranking, Today, Board (with the phone list), reports, block list, ZIP backup in the skill's format. |
| **v1.0** | All P1: a 3rd provider and the model picker, PWA install, run on open, hiring posts by others, recruiter filter, source plug-ins, draft checker, linked folder, search and filters, notes, Not now, undo, retention, key passphrase, theme. |
| **Desktop (later)** | Windows, macOS and Linux app reusing the core (NFR-12): background scheduling, OS secure key storage, a real data folder by default. |
| **Later** | P2: stats, provider fallback, offline draft checks, more regions and languages. |

## 18. Decisions

| # | Decision | Date |
|---|---|---|
| D1 | Web first. Desktop later, because building and signing for every OS takes time. | 2026-11-14 |
| D2 | Several AI providers, behind one adapter interface. | 2026-11-14 |
| D3 | Search through the AI provider's built-in web search, with Firecrawl as an option. | 2026-11-14 |
| D4 | Keep the name "Get Me Hired". | 2026-11-14 |
| D5 | Host on Netlify, not GitHub Pages. Each Netlify site gets its own origin. Netlify can send a real CSP header (GitHub Pages can't set headers), and every pull request gets a Deploy Preview. The app stays static: no Netlify Functions. | 2026-11-14 |
| D6 | Launch on the Netlify subdomain `get-me-hired.netlify.app` (claimed 2026-11-14, project `get-me-hired` on the kleenpulse team), with no custom domain. This is the app's permanent home: browser data is tied to the address, so moving later would force every user to export and import. | 2026-11-14 |
| D7 | Follow-up cadence of 5, then 7, then 7 working days, with at most 2 follow-ups, then `no-reply` (§8.2). Adjustable. | 2026-11-14 |
| D8 | The HN monthly thread and mail-domain handling are P0, based on the first live hunt (Appendix A). | 2026-11-14 |
| D9 | Contacts must be email-first even when a post asks for a DM or form, following the method (FR-5.6). | 2026-11-14 |
| D10 | Only the minimum about third parties is stored, with 180-day auto-removal for closed leads (§13). | 2026-11-14 |
| D11 | Stack: Vite with React and TypeScript, built to static files. Tailwind CSS v4 on the tokens in [DESIGN.md](DESIGN.md), Vitest for tests, Bun as the package manager. No `src/` directory. The app is fully static with no server (D5), so a server framework would add nothing. | 2026-11-14 |
| D12 | Provider adapters are built on the Vercel AI SDK (`ai` v7 with `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` and `@openrouter/ai-sdk-provider`), not on each provider's own SDK or on hand-written requests. It gives one interface for text, structured output, the providers' web-search tools and token counts, which is what FR-2.6 asks for. The SDK and each provider package load only when needed, because the SDK core is about 96 kB gzipped and one provider adds 25 to 60 kB (measured 2026-11-14). Firecrawl isn't an AI provider and is called directly. | 2026-11-14 |
| D13 | The default provider recommended to first-time users is Google Gemini with the `gemini-3.1-flash-lite` model. It was the cheapest model that passed the spike (§19). A free Gemini key runs a hunt of the HN thread and funding news at no cost. Turning on billing adds web search, where Google's price list gives the first 5,000 searches a month free. Web search on a billed key is still to be tested. Without it, a hunt can't find fresh LinkedIn or X posts, and the app must say so. | 2026-11-14 |
| D14 | **Proposed, owner to confirm.** When an AI provider reads a page for the app and the app can't see the page itself (Gemini's page reader, on news sites that don't allow browser reads), the facts it reports are labelled on the lead as read by that provider and not checked by the app. They are never shown as checked (principle 2). A page source that gives the app the page text (Firecrawl, FR-2.3) lets the code check quotes and dates, and only then may facts be shown as checked. | Proposed 2026-11-15 |

## 19. Open questions

1. **Which providers pass the browser check?** Each candidate (and Firecrawl) must be tested for direct browser calls before it's promised. The spike in §17 answers this.

   **First pass, 2026-11-14 (not final).** A page served from `http://localhost:5183` in Chrome 157 called each provider with a made-up key (`bun run spike`). A readable answer, even "wrong key", shows that the provider lets a browser page read its answers with those headers. It doesn't yet show that a real, successful call works, or that it works from the production address. Checks (b) and (c) of FR-2.2 are untested, and so is cost.

   | Provider | Result with a made-up key |
   |---|---|
   | Anthropic | Readable (401) on `GET /v1/models` and `POST /v1/messages`. The requests carried the `anthropic-dangerous-direct-browser-access: true` header. |
   | Google Gemini | Readable (400, "API key not valid") on `GET /v1beta/models` and `POST …:generateContent`. |
   | OpenRouter | Readable (401) on `GET /api/v1/key` and `POST /api/v1/chat/completions`. |
   | Firecrawl | Readable (401) on `GET /v2/team/credit-usage`, `POST /v2/search` and `POST /v2/scrape`. |
   | OpenAI | **Unclear.** `GET /v1/models` is readable (401). Every `POST` tried (`/v1/responses`, `/v1/chat/completions`, `/v1/embeddings`) passes the preflight, but the 401 answer has no `Access-Control-Allow-Origin` header, so the browser hides it. A real key must show whether successful answers are readable. Even if they are, the app may be unable to read OpenAI's error answers on these endpoints (wrong key, no credit, rate limit), which AC-2.4 and AC-4.11 depend on. |

   **Through the AI SDK, 2026-11-14 (not final).** The same check sent through the Vercel AI SDK (D12) gave the same results in Chrome 157. Anthropic, Gemini and OpenRouter return an error the app can read. OpenAI's refused `POST` is hidden, and the SDK passes it on as a plain "Failed to fetch" with no status. Until a real key shows more, an OpenAI key test should use `GET /v1/models`, whose answers are readable.

   The SDK adds a `user-agent` header to every request. Chrome drops it, but Firefox and Safari send it. All four providers' preflight answers list `user-agent` as allowed, so those browsers should pass. That is a prediction: the check hasn't been run in Firefox or Safari yet.

   **Real keys, 2026-11-14 (partial).** Two keys were tested from a browser page in Chrome 157: OpenRouter and NVIDIA. NVIDIA isn't on the candidate list in FR-2.1. It was tested because the owner has a key.

   - **NVIDIA fails check (a).** Its preflight answer has no `Access-Control-Allow-Origin` header, so a browser can't call it at all, with any key. It can't be supported on the web (§20). It stays possible for the desktop app.
   - **OpenRouter passes all three checks** through the AI SDK:

   | Check | Result |
   |---|---|
   | (a) Browser calls | A real call answered. Error answers are readable too, including "not enough credit". |
   | (b) Structured output | Right on all 4 models tried: `anthropic/claude-haiku-5.5`, `openai/gpt-6-luna` and 2 free models (`nvidia/nemotron-3.5-super-vl:free` and `inclusionai/ling-3.2-flash:free`; the ids come from the spike's run output, which is not kept in the repo, and the second passed a real-key test again on 2026-11-15). Each one ignored an instruction planted in the page text (NFR-4). On the paid models, reading one post cost $0.0001 to $0.00016. |
   | (c) Web search | `openai/gpt-6-luna` found the current HN "Who is hiring?" thread. That one search cost $0.011, of which $0.01 was the search fee. |
   | (c) Page reading | OpenRouter's web fetch tool read the thread's page on the same 2 free models, with its free `openrouter` engine. Cost: $0. |

   Not measured yet: Google models (the account ran out of credit first), Claude with search, and the cost and yield of a whole hunt (question 2).

   **What these runs mean for the build:**

   1. **A tool and JSON output don't mix in one call.** With a search or fetch tool in the request, 5 of 6 runs didn't return the JSON that was asked for. In the 2 runs where the raw answer was kept, the model had answered in plain sentences. The fix is two calls: one with the tool that answers in text, then one with no tools that turns the text into checked JSON. This also keeps fetched page text away from any call that holds tools (NFR-4). Both free models passed page reading this way.
   2. **Always cap the answer length.** Without a cap, OpenRouter reserves the model's full output size and refuses the call when the account can't cover it.
   3. **The HN thread needs no AI.** Hacker News's search API (`hn.algolia.com`) allows browser calls and returned the current "Who is hiring?" thread directly, for free. FR-4.7 can use it.
   4. **Search fees will be most of the cost.** OpenRouter charges $0.007 to $0.014 for each search, depending on the engine. The 40 searches allowed in §12 would cost $0.28 to $0.56 in fees, before tokens. This is worked out from list prices, not measured from a hunt.
   5. **A free path exists for everything except search.** OpenRouter's free models handled structured output and page reading. An account with no credit gets 50 free-model requests a day.

   **Gemini, and a hunt with no search, 2026-11-14.** A Google Gemini key on the free tier was tested the same way, through the AI SDK from Chrome 157.

   | Check | Result on the free tier |
   |---|---|
   | (a) Browser calls | Pass. Real calls answered, and error answers are readable. |
   | (b) Structured output | Pass on `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite`, in about 1.5 seconds. Both ignored the planted instruction. |
   | (c) Page reading | Pass. The URL context tool read the HN thread's page. |
   | (c) Web search | **Not available.** Every search call returned 429 "quota exceeded" at once, on every model tried. Google's price list says search is "Not available" on the free tier. On the paid tier the first 5,000 searches a month are free, then $14 per 1,000. |

   The cheapest Gemini model that still works is `gemini-3.1-flash-lite`: free on the free tier, $0.25 in and $1.50 out per million tokens on the paid tier. Google has closed `gemini-2.5-flash-lite` and `gemini-2.5-flash` to new users. `gemini-3.8-flash` answered "high demand" for two minutes and was not measured.

   **One hunt with no search provider**, on `gemini-3.1-flash-lite`, with an invented profile (a remote frontend engineer in Kenya):

   | Stage | What it did | Result |
   |---|---|---|
   | HN thread | Read all 244 posts from HN's own API with no AI. Kept the 64 that mention "remote" and a wanted skill. Sent those to the model, 8 at a time. | 12 leads kept, 52 dropped (38 location, 11 role mismatch, 3 pay below floor). 8 calls. |
   | Funding | Read 3 news listing pages with the page reader, then turned each answer into JSON. | 28 rounds found, 4 of them seed or pre-seed, 2 with a date inside 14 days. 6 calls. |
   | Fresh posts | Not possible without search. | 0 |
   | Whole hunt | 14 calls, about 2.5 minutes run one at a time, about 35,000 tokens in and 11,000 out. | $0 on the free tier. About $0.03 at the paid list price (worked out, not billed). |

   Checks done in code, not by the model: all 5 email addresses the model reported were found in the post's text (AC-5.3). 61 of the 64 reasons it quoted were found word for word in the post. No answer pointed at a post that wasn't sent.

   Not done in this hunt: confirming round dates at the source (AC-4.6), finding people and contacts for funded startups, and anything on LinkedIn or X.

   **More findings for the build:**

   6. **The page reader opens web pages, not feeds.** Gemini's URL context tool read every listing page tried and failed on every RSS feed, including the same sites' own feeds. Funding sources should be listing pages.
   7. **A feed or tag page can be stale and still look alive.** TechCrunch's "seed funding" tag stopped in March 2026 but still serves 20 items. Each source needs a check on the date of its newest item.
   8. **Ask the model to quote its reason, then check the quote in code.** It is cheap, it catches invented reasons, and it gives "Dropped, and why" a real source (principle 2).
   9. **HN needs no search and gave most of the leads,** as in the first live hunt (Appendix A).
   10. **Gemini's rate-limit answer has no `retry-after` header the page can read.** The wait time must come from the answer's body, or fall back to the 10 seconds in AC-4.11.
   11. **Gemini's search tool takes a time range** (a start and an end time), so past-day searches may not need Firecrawl (FR-2.3). This is from the SDK's docs and is untested, because the free tier has no search.
   12. **Gemini's page reader can't see links** (measured 2026-11-15, in the app's funding stage, on the free tier). It read all 3 listing pages, and named 32 rounds, but gave every item the listing's own address, not the item's. A round seen only on a list fails AC-4.6, so on a free Gemini key the funding stage keeps nothing: 10 calls in 111 seconds, 0 kept. The stage is built and tested, and the app switches it off until a page source that returns links is added, such as Firecrawl, whose browser access with a real key is still unconfirmed. So D13's "funding news at no cost" does not hold yet.

2. **Default provider.** Which provider and model is recommended to first-time users, based on the spike's cost and quality results? **Answered by D13:** Google Gemini with `gemini-3.1-flash-lite`.
3. **Funding regions.** Which regional news sources ship by default (Africa, India, EU, US)?

## 20. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A provider blocks browser calls | It can't be supported on the web without a proxy, and a proxy breaks "no server" | Support only providers that pass FR-2.2. Revisit in the desktop app, which has no CORS limits. A Netlify Function proxy is technically possible, but it would put user keys and data through our server and break principle 3, so it would need its own decision. |
| Built-in web search finds few LinkedIn and X posts | Fewer fresh-post leads (the first live hunt kept 2 of about 30 LinkedIn results and none from X) | Optional Firecrawl key. Lean on funding news and HN, which gave 13 of the 14 kept leads. Say clearly in the report when a source found nothing. |
| LinkedIn or X change how post IDs work | The age check breaks silently | Fall back to a date printed on the page. A decoder test against recent fixtures fails loudly in CI. |
| Tracker pages list old rounds as news | Stale leads (one $58M "seed" from March showed up in November) | Confirm every round at its source (AC-4.6) |
| A user clears browser data, or Safari evicts it | Leads and keys are lost | Persistent storage request, Safari warning, backup reminders, linked folder (FR-9.1–9.3) |
| A user pastes a key on a shared computer | Someone else could use the key | Passphrase encryption (FR-10.4), "Remove key", a shared-computer warning during key setup |
| A page-derived cell in the exported `leads.csv` starts with `=`, `+`, `-`, `@` or a tab | Opened in Excel or Google Sheets, the cell may run as a formula | **Open, for the owner to decide.** Escaping such cells (a leading `'`) protects spreadsheet users but changes the values the agent skill reads back. Current spreadsheet apps mostly warn before running formulas from a CSV. Until decided, the CSV is written exactly as the data is. |
| A fetched page carries instructions for the AI | The hunt follows them (prompt injection) | NFR-4: page text is data, never instructions. Structured output only. Every kept field is checked against its source. |
| Provider prices change | Cost estimates go wrong | One price file with a "last checked" date. Show actual cost from provider responses where available. |

## 21. Glossary

- **Seed round / pre-seed:** a startup's first money from investors. This is usually when they start hiring.
- **Hook:** a true, specific fact you can mention in your email (something they shipped, something the post asked for).
- **Published / Pattern / Guess:** how sure we are about an email address (see FR-5.3).
- **Lead:** one company worth contacting, found through a hiring post, a funding round or a community thread.
- **Signal:** a tag that lowers a lead's tier without dropping it, such as "pay unknown" (§9.2).
- **Tier:** A, B or C: how good a lead is, based on its signals and contacts (§9.3).
- **Follow-up:** a short second email when there's no reply (§8.2).
- **Working day:** Monday to Friday, in your time zone.
- **AI provider:** the company whose AI model runs the hunt (for example Anthropic, OpenAI or Google). You use your own key and pay them directly.
- **Search provider:** the service that searches the web and reads pages. By default it's your AI provider's built-in search, or Firecrawl if you add a key.
- **API key:** a password-like code from a provider that lets this app use your account.

## Appendix A. Evidence from the first live hunt (2026-11-14)

The `get-me-hired` agent skill ran one real hunt for a frontend-heavy full-stack engineer profile. This is what it found, and the requirement each finding led to.

| What happened | Requirement |
|---|---|
| 18 searches were planned. 8 hit Firecrawl's rate limit, and a parallel retry was rejected again, because rejected requests count against the limit. Running them one at a time, about 10 seconds apart, worked. | FR-4.11, AC-4.11, §12 |
| About 30 LinkedIn results came back. After the age check and reading, 2 were usable: one design-engineer post (7 reactions, company not named, asked for a DM) and one investor post pointing to a newly funded company. The rest were interns, local-only jobs, agency recruiters, mechanical and RF "design engineer" roles, and an anonymous AI-training gig with 300 openings. | FR-4.9, FR-4.17, §9.1 `role-mismatch` and `recruiter` |
| X searches gave 0 usable posts. | Risk table, §10.2 "Hunt found nothing new" |
| Funding news and founders' or team members' "we raised" posts gave 7 companies, all announced within 4 days. | FR-4.6 |
| A "$58M seed" from a 2026 funding list turned out to be from March. | AC-4.6, `stale` |
| One company had only a paywalled note and no other public record. | FR-4.18, `unverifiable` |
| The HN monthly thread gave 6 openings. The thread forbids recruiters, and many comments publish an email. | FR-4.7 raised to P0, FR-4.21 |
| One company showed up both as a fresh post and as a funding round. | FR-4.16 |
| 18 email addresses: 6 Published, 2 Pattern, 10 Guess. The Published ones came from YC company and launch pages, a German Impressum page, and HN comments. One company's mail domain (`.com`) differed from its site (`.ai`). | FR-5.3, FR-5.4 raised to P0 |
| Most funded startups listed no open role and no pay. Several roles needed relocation. | §9.2 `no-open-role`, `pay-unknown`, `relocation`, `visa-unknown` |
| Several posts asked for a DM or form, but the method says to email anyway. | FR-5.6, D9 |
| One run held 3 people at a single company. | FR-6.10 per-person tracking |
| Cost wasn't measured, because the hunt ran inside a coding agent. | Spike in §17 |
