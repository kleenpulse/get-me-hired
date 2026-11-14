# Get Me Hired: Functional Requirements (FRD)

| | |
|---|---|
| Status | Draft v0.3 |
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
| FR-1.2 | The first-run wizard explains in 3 short screens what the app does, what it won't do (rules in §4), what it costs (see FR-3.12), and that data stays in this browser. | P0 |
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

### 6.4 The hunt

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | One big **Run today's hunt** button. | P0 |
| FR-4.2 | **Run on open:** a setting that starts the hunt when the app is opened and today's hunt hasn't run yet. The web app can't run while closed. Real scheduling comes with the desktop app. | P1 |
| FR-4.3 | **Fresh posts:** search public LinkedIn and X hiring posts from the last 24 hours that match the profile's roles and skills. | P0 |
| FR-4.4 | **Freshness check:** for LinkedIn and X posts, read the publish time from the post ID in the URL. This runs in the browser, with no network or login. Drop posts older than 24 hours. Other sites need a date printed on the page, or the post is labelled "age unknown" and listed last. | P0 |
| FR-4.5 | **Likes:** read the reaction count from the public page through the fetch provider. If it can't be seen, show "unknown". Drop posts with 100 or more. | P0 |
| FR-4.6 | **Seed rounds:** find pre-seed and seed rounds announced in the last 14 days (news sites, YC launches, founders' own posts). Confirm the date at the original source. List Series A and later separately, as lower priority. | P0 |
| FR-4.7 | **Community job threads:** include the current month's Hacker News "Who is hiring?" thread, filtered to the profile. | P1 |
| FR-4.8 | **Fit filter:** skip leads that don't match role, location, remote, visa or pay floor. Each kept lead shows a one-line reason it fits. Skipped leads appear under "Dropped, and why". | P0 |
| FR-4.9 | **Recruiter filter:** detect and drop agency or recruiter posts and anonymous gig listings, and explain why. | P1 |
| FR-4.10 | Progress shows in plain steps ("Searching LinkedIn posts…", "Checking 14 posts are under a day old…"). The user can cancel, and the app keeps whatever it already found. | P0 |
| FR-4.11 | Handle rate limits by pacing requests and retrying with backoff. Retries must not fire all at once, because rejected requests can count against the limit too. A source that keeps failing is listed under "Couldn't search today", and the rest of the run still finishes. | P0 |
| FR-4.12 | **Sources are plug-ins.** Each source (LinkedIn posts, X posts, funding news, HN, YC, regional news) is a separate module that can be switched on or off. Contributors can add one without changing the core. | P1 |
| FR-4.13 | **Cost control:** show the estimated cost before each run and the actual cost after it, per provider. The user sets a monthly spending cap, and runs stop at the cap. Price tables live in one file in the repo, with the date they were last checked. | P0 |
| FR-4.14 | Target about 20 people per day: roughly 6–8 posts and 4–6 funded startups with up to 3 people each. The target is adjustable. | P1 |
| FR-4.15 | Keep the tab awake during a run, and warn before the tab is closed mid-run. If a run is interrupted, offer to resume or discard it next time. | P1 |

### 6.5 People and contacts

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | For posts: the person who posted, then one founder. For funded startups: up to 3 people, founders first, then the lead closest to the user's role. | P0 |
| FR-5.2 | Contact sources are limited to public, professional ones: the post itself, the company site (team, careers, contact, legal or imprint pages), the person's own site, a public GitHub profile, YC pages, and community job threads. | P0 |
| FR-5.3 | Every email address carries one label: **Published** (written on a public page, with the link), **Pattern** (built from an address format the company uses publicly, with the example shown), or **Guess** (no evidence). | P0 |
| FR-5.4 | Build Pattern and Guess addresses on the company's mail domain, which can differ from its website domain. | P1 |
| FR-5.5 | Show "Verify before sending" next to Pattern and Guess addresses, with a link to explain why. | P0 |
| FR-5.6 | If a post asks for a DM, a form or an apply link instead of email, show that as the contact method. Never invent an email. | P0 |

### 6.6 Today's list and the leads board

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | **Today** is the home screen: a short list of the people to email today, best fit first, plus follow-ups due. It answers one question: "who do I write to now?" | P0 |
| FR-6.2 | Each lead card shows: company, what they do (one line), role, freshness or round date, likes, fit reason, people and contacts with labels, hooks, and source links. | P0 |
| FR-6.3 | **Board view** with columns New → Emailed → Replied → Call → Offer, plus Not now and Skip. Cards move by drag-and-drop or by keyboard. | P0 |
| FR-6.4 | **Mark as emailed** records the date, schedules a follow-up (default: 5 working days, adjustable) and moves the card. | P0 |
| FR-6.5 | Contact actions: copy address, and open the user's own email app (`mailto:`) with only the address and a blank subject. Never add body text. | P0 |
| FR-6.6 | Search and filter by status, type (post or funding), domain, location, date and label. | P1 |
| FR-6.7 | Personal notes on each lead. | P1 |
| FR-6.8 | No duplicates: the same post URL is never added twice, and a company already pitched in the last 30 days only comes back as a follow-up. | P0 |
| FR-6.9 | Simple stats: emails sent this week, reply rate, calls booked, and the sources that led to replies. | P2 |

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

### 6.10 Settings

| ID | Requirement | Priority |
|---|---|---|
| FR-10.1 | Providers and keys (§6.2), each with a test button and a remove button. | P0 |
| FR-10.2 | Daily target, follow-up delay, monthly spending cap, run on open. | P0 |
| FR-10.3 | Turn sources on or off, and pick a region for funding news. | P1 |
| FR-10.4 | Optional passphrase that encrypts stored keys in the browser. The passphrase is asked once per session. | P1 |
| FR-10.5 | Light, dark and system theme. Text size. | P1 |

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Accessibility:** WCAG 2.2 AA. Every action works by keyboard, focus is always visible, screen-reader labels are on all controls, and motion turns off when the system asks for reduced motion. |
| NFR-2 | **Privacy:** no analytics, no third-party scripts, no fonts or CDNs loaded from other sites. The only network requests go to the providers the user configured. |
| NFR-3 | **Security, keys:** keys never leave the browser except in requests to their own provider. Optional encryption at rest (FR-10.4). The app is served from **its own origin**, `get-me-hired.netlify.app` (D6), never a path on a host other apps share, since browser storage is per origin. A strict Content Security Policy, sent as an HTTP header from Netlify's headers config, allows requests only to known provider domains. |
| NFR-4 | **Security, content:** fetched web pages are shown as text, never as live HTML, and treated as untrusted. Instructions found inside a page are ignored by the hunt logic. |
| NFR-5 | **Static hosting on Netlify:** the whole app builds to static files, with no server code and no Netlify Functions. Netlify builds from the GitHub repo: every push to `main` deploys to production, and every pull request gets a Deploy Preview link, so contributors and reviewers can try changes before merging. Build settings, security headers and SPA redirects live in `netlify.toml` in the repo. |
| NFR-6 | **Performance:** first load under 3 seconds on a mid-range laptop on 4G. Today and Board stay smooth with 5,000 leads. A typical hunt finishes in under 10 minutes. |
| NFR-7 | **Reliability:** an interrupted run or a closed tab never corrupts stored data. Writes are all-or-nothing. |
| NFR-8 | **Responsive:** every screen works from 360px wide (phone) up to desktop. |
| NFR-9 | **Language:** plain English, at about an 8th-grade reading level, with no unexplained jargon. All interface text sits in one file, ready for translation later. |
| NFR-10 | **Cost transparency:** a typical daily run should cost less than a cup of coffee with the recommended defaults. The exact target will be set after measuring real runs. |
| NFR-11 | **Ethics:** the rules in §4 are enforced in code, not only in documentation. There's no setting to turn on login scraping, mail-server probing or auto-sending. |
| NFR-12 | **Portable core:** the hunt logic, provider adapters and data format live in modules with no browser-only dependencies, so the later desktop app reuses them. |

## 8. Data model (summary)

- **Profile**: the fields in FR-3.3.
- **Lead**: id, type (post or funding), company, company URL, source URL, posted or announced date, age, likes, round, role, fit reason, hooks, status, status history, next action date, notes.
- **Person**: name, role, lead id.
- **Contact**: person id, method (email, DM, form, link), value, label (published, pattern, guess), evidence URL or example.
- **Run**: date, provider(s), sources used, counts (found, kept, dropped), dropped reasons, searches that found nothing, failures, cost.
- **Provider config**: provider, model, key (encrypted if a passphrase is set), last test result, capabilities passed.

## 9. Success measures

- A non-technical user goes from opening the link to finishing their first hunt in **under 10 minutes**, with no help.
- **100%** of LinkedIn and X posts shown were checked as under 24 hours old.
- **100%** of email addresses shown carry a label, and every Published address links to its source.
- At least **3 AI providers** pass the checks in FR-2.2 and are supported at v1.
- After two weeks, users who send about 20 emails a day get calls, the outcome the method promises. The app measures this only from the user's own status updates.

## 10. Release plan

| Release | Contents |
|---|---|
| **Spike (before MVP)** | Test FR-2.2 against each candidate provider and Firecrawl: browser calls, structured output, built-in search and fetch. Measure the cost of one real hunt per provider. The results decide the v1 provider list. |
| **MVP (v0.1)** | All P0: web app on Netlify, at least 2 providers, profile from questions and CV, hunt (posts, funding, freshness, contacts, labels, cost cap), Today, Board, reports, ZIP backup in skill format. |
| **v1.0** | All P1: a 3rd provider and model picker, PWA install, run on open, HN source, recruiter filter, source plug-ins, draft checker, linked folder, search and filters, notes, key passphrase, theme. |
| **Desktop (later)** | Windows, macOS and Linux app reusing the core (NFR-12): background scheduling, OS secure key storage, a real data folder by default. |
| **Later** | P2: stats, provider fallback, offline draft checks, more regions and languages. |

## 11. Decisions

| # | Decision | Date |
|---|---|---|
| D1 | Web first. Desktop later, because building and signing for every OS takes time. | 2026-11-14 |
| D5 | Host on Netlify, not GitHub Pages. Each Netlify site gets its own origin. Netlify can send a real CSP header (GitHub Pages can't set headers), and every pull request gets a Deploy Preview. The app stays static: no Netlify Functions. | 2026-11-14 |
| D6 | Launch on the Netlify subdomain `get-me-hired.netlify.app` (claimed 2026-11-14, project `get-me-hired` on the kleenpulse team), with no custom domain. This is the app's permanent home: browser data is tied to the address, so moving later would force every user to export and import. | 2026-11-14 |
| D2 | Several AI providers, behind one adapter interface. | 2026-11-14 |
| D3 | Search through the AI provider's built-in web search, with Firecrawl as an option. | 2026-11-14 |
| D4 | Keep the name "Get Me Hired". | 2026-11-14 |

## 12. Open questions

1. **Which providers pass the browser check?** Each candidate (and Firecrawl) must be tested for direct browser calls before it's promised. The spike in §10 answers this.
2. **Default provider.** Which provider and model is recommended to first-time users, based on the spike's cost and quality results?
3. **Funding regions.** Which regional news sources ship by default (Africa, India, EU, US)?

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A provider blocks browser calls | It can't be supported on the web without a proxy, and a proxy breaks "no server" | Support only providers that pass FR-2.2. Revisit in the desktop app, which has no CORS limits. A Netlify Function proxy is technically possible, but it would put user keys and data through our server and break principle 3, so it would need its own decision. |
| Built-in web search finds few LinkedIn and X posts | Fewer fresh-post leads | Optional Firecrawl key. Lean on funding news and HN, which yield more leads in practice. Say clearly in the report when a source found nothing. |
| A user clears browser data | Their leads and keys are lost | Persistent storage request, backup reminders, linked folder (FR-9.1–9.3). |
| A user pastes a key on a shared computer | Someone else could use the key | Passphrase encryption (FR-10.4), "Remove key" in settings, and a warning about shared computers during key setup. |
| Provider prices change | Cost estimates go wrong | One price file with a "last checked" date. Show actual cost from provider responses where available. |

## 14. Glossary

- **Seed round / pre-seed:** a startup's first money from investors. This is usually when they start hiring.
- **Hook:** a true, specific fact you can mention in your email (something they shipped, something the post asked for).
- **Published / Pattern / Guess:** how sure we are about an email address (see FR-5.3).
- **Lead:** one hiring post or one funded startup worth contacting.
- **AI provider:** the company whose AI model runs the hunt (for example Anthropic, OpenAI or Google). You use your own key and pay them directly.
- **Search provider:** the service that searches the web and reads pages. By default it's your AI provider's built-in search, or Firecrawl if you add a key.
- **API key:** a password-like code from a provider that lets this app use your account.
