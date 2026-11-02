# musaorak.com

Personal research website for Musa Orak. Plain HTML and CSS, no build step, no dependencies.

## Files

| File | What it is |
|---|---|
| `index.html` | About page (home) |
| `research.html` | Publications, policy notes, working papers, work in progress |
| `teaching.html` | Teaching record |
| `assets/style.css` | The single stylesheet (light and dark mode) |
| `assets/photo.jpg` | Portrait (converted from `IMG_0058.heic`, which stays out of the published site) |
| `main.tex` | CV source (LaTeX) |
| `Orak_CV.pdf` | Built CV, linked from the nav |
| `build_cv.sh` | Rebuilds `Orak_CV.pdf` from `main.tex` |
| `CNAME` | Tells GitHub Pages the custom domain is `musaorak.com` |

## Editing

- **Add a paper:** copy one `<article class="pub">…</article>` block in `research.html` and edit it. Put it under the right heading: Publications, Policy Notes and Papers, Working Papers, or Work in Progress.
- **Update the CV:** edit `main.tex`, then run `./build_cv.sh`.
- **Change the photo:** replace `assets/photo.jpg` (any HEIC can be converted with `sips -s format jpeg -Z 900 IN.heic --out assets/photo.jpg`).
- **Preview locally:** run `python3 -m http.server 8000` in this folder and open <http://localhost:8000>.

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
