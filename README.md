# musaorak.com

Personal research website for Musa Orak. Plain HTML and CSS, no build step, no dependencies.

## Files

| File | What it is |
|---|---|
| `index.html` | About page (home) |
| `research.html` | Publications, policy notes, working papers, work in progress |
| `teaching.html` | Teaching record |
| `assets/style.css` | The single stylesheet (light and dark mode) |
| `assets/headshot.jpg` | Main portrait (shown as a circle on the About page) |
| `assets/with-yellen.jpg` | Photo with Janet Yellen (converted from `IMG_0058.heic`, which stays out of the published site) |
| `assets/eccles-building.jpg` | Public-domain Federal Reserve photo of the Eccles Building, shown next to Contact |
| `main.tex` | CV source (LaTeX) |
| `Orak_CV.pdf` | Built CV, linked from the nav |
| `build_cv.sh` | Rebuilds `Orak_CV.pdf` from `main.tex` |
| `CNAME` | Tells GitHub Pages the custom domain is `musaorak.com` |
| `assets/beacon.js` | One-line visit beacon loaded by every page; calls the `visits` Worker |
| `worker/` | The `visits` Cloudflare Worker (`visits.js`: beacon plus the `/report` page), its Wrangler config, and `report.sh` for reading the numbers in a terminal |

## Editing

- **Add a paper:** copy one `<article class="pub">…</article>` block in `research.html` and edit it. Put it under the right heading: Publications, Policy Notes and Papers, Working Papers, or Work in Progress.
- **Update the CV:** edit `main.tex`, then run `./build_cv.sh`.
- **Change a photo:** replace the file in `assets/` (any HEIC can be converted with `sips -s format jpeg -Z 900 IN.heic --out assets/headshot.jpg`).
- **Visitor statistics:** every page ends with two snippets: the Cloudflare Web Analytics beacon (countries, pages, referrers, at <https://dash.cloudflare.com/?to=/:account/web-analytics>) and `assets/beacon.js`, which records the visitor's network organization (see *Who is visiting* below). Keep both when adding a new page.
- **Preview locally:** run `python3 -m http.server 8000` in this folder and open <http://localhost:8000>.

## Who is visiting: the `visits` Worker

Cloudflare Web Analytics shows countries and pages but not whose network a visitor is on.
The `worker/` folder holds a tiny Cloudflare Worker that adds that: each page calls
`https://visits.musaorak.com` once (via `assets/beacon.js`), and the Worker stores the owner
of the visitor's IP block (a university, a central bank, an ISP), the country and city, the
page, and the referring site in a Workers Analytics Engine dataset. No IP addresses are
stored and no cookies are set. The Worker and the dataset are on Cloudflare's free plan.
The main site stays on GitHub Pages with DNS-only records; only `visits.musaorak.com` is
served by Cloudflare.

### One-time setup (Cloudflare dashboard)

1. **Create the Worker.** <https://dash.cloudflare.com> → *Workers & Pages* → *Create* → *Start with Hello World!* → name it `visits` → *Deploy*.
2. **Paste the code.** Run `pbcopy < worker/visits.js` to copy the Worker code (the file in the `worker` folder, not `assets/beacon.js`, which is the browser-side script). Open the Worker → *Edit code* → select all, paste, → *Deploy*.
3. **Bind the dataset.** Worker → *Settings* → *Bindings* → *Add* → *Analytics Engine* → variable name `VISITS`, dataset `visits` → *Deploy*. The dataset is created on the first write.
4. **Give it the address the pages call.** Worker → *Settings* → *Domains & Routes* → *Add* → *Custom domain* → `visits.musaorak.com`. Cloudflare adds the DNS record and certificate itself.
5. **Create a read token for reports.** Profile icon (top right) → *API Tokens* → *Create Token* → *Create Custom Token* → permission *Account* / *Account Analytics* / *Read* → copy the token. The account ID is in the right-hand column of the *Workers & Pages* overview. Save both where the report script looks:
   ```sh
   mkdir -p ~/.config
   cat > ~/.config/musaorak-visits.env <<'EOT'
   export CF_ACCOUNT_ID=paste-account-id-here
   export CF_API_TOKEN=paste-token-here
   EOT
   chmod 600 ~/.config/musaorak-visits.env
   ```

After step 4, open <https://musaorak.com> once, wait a minute, and run the report below; your own visit should appear.

### Reading the numbers

```sh
./worker/report.sh                # visits by network organization, last 30 days
./worker/report.sh 7              # last 7 days
./worker/report.sh 30 pages       # by page
./worker/report.sh 30 referrers   # by referring site
./worker/report.sh 30 days        # per day
```

Expect many rows for residential and mobile carriers (Comcast, Verizon, T-Mobile) and for
Apple's iCloud Private Relay. An institution shows up only when someone reads the site from
its office or campus network or its VPN. Analytics Engine keeps about three months of data.

### Browser version

The Worker can also render the same tables as a web page at
`https://visits.musaorak.com/report?key=<REPORT_KEY>` (add `&days=7` or `&days=90` to change
the window). It needs three variables on the Worker, set once in the dashboard: open the
`visits` Worker → *Settings* → *Variables and Secrets* → *Add*, then *Deploy*:

| Name | Type | Value |
|---|---|---|
| `CF_ACCOUNT_ID` | Text | the account ID (same value as in `~/.config/musaorak-visits.env`) |
| `CF_API_TOKEN` | Secret | the read token (same value as in `~/.config/musaorak-visits.env`) |
| `REPORT_KEY` | Secret | a long random string; `openssl rand -hex 20` makes one. Keep it in the env file too |

Run `cat ~/.config/musaorak-visits.env` to see the values to paste. The report URL with the key
is the only credential; bookmark it rather than sharing it. A wrong or missing key returns 404.

## Step 1: register the domain

`musaorak.com` expired around early 2022 and is currently **unregistered**, so anyone can take it. Register it right away and turn on auto-renew so this does not happen again.

Recommended registrars (both sell `.com` at roughly cost, with free WHOIS privacy):

- **Cloudflare Registrar** (about $10–11/yr): <https://dash.cloudflare.com/?to=/:account/domains/register>. Pairs well with Cloudflare Pages for hosting.
- **Porkbun** (about $12/yr): <https://porkbun.com/checkout/search?q=musaorak.com>

## Step 2: host the site (GitHub Pages)

1. Create a free account at <https://github.com> if you do not have one.
2. Create a new **public** repository named `musaorak.com`.
3. Push this folder to it:
   ```sh
   git remote add origin https://github.com/<your-username>/musaorak.com.git
   git push -u origin main
   ```
4. In the repository, open **Settings → Pages**. Under *Build and deployment*, set Source to *Deploy from a branch*, branch `main`, folder `/ (root)`. Save.
5. Still under **Pages**, enter `musaorak.com` as the custom domain and save. Tick *Enforce HTTPS* once it becomes available (a few minutes after DNS resolves).

## Step 3: point the domain at the site

At your registrar's DNS settings, add these records:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `<your-username>.github.io` |

Within an hour, <https://musaorak.com> and <https://www.musaorak.com> will both serve the site with HTTPS.

### Alternative: Cloudflare Pages

If you register at Cloudflare, you can instead host on Cloudflare Pages: *Workers & Pages → Create → Pages → Connect to Git* (or *Direct Upload* of this folder), then *Custom domains → musaorak.com*. DNS is configured for you automatically.

## Updating the live site

After editing files:
```sh
git add -A
git commit -m "Describe the change"
git push
```
GitHub Pages redeploys within a minute or two.
