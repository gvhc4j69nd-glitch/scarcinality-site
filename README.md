# Scarcinality

The website and blog for **scarcinality**, an economic theory: *scarcity is ordered, and in a credit economy a shortage of money outranks a shortage of goods.*

This is a static site served by a tiny zero-dependency Node server, ready to deploy on Railway and point at `scarcinality.com`.

## What's here

```
scarcinality-site/
  server.js            zero-dependency static server (binds to $PORT)
  package.json         start script + node engine
  public/
    index.html         home / Start Here
    cornerstone.html   the founding essay
    treatise.html      web edition of the full treatise
    theory.html        the theory series index
    theory-01.html     first post in the series (template for the rest)
    dispatches.html    live application + the standing assumptions ledger
    glossary.html      the vocabulary of the theory
    404.html
    assets/
      style.css        shared styles (EB Garamond + IBM Plex Mono, oxblood/parchment)
      phaseplane.svg   the signature diagram
      Scarcinality.pdf the typeset treatise
      favicon.svg
```

## Run locally

```bash
npm start
# then open http://localhost:3000
```

No build step and no dependencies. Node 18 or newer.

## Deploy: GitHub then Railway

**1. Push to GitHub.**

```bash
cd scarcinality-site
git init
git add .
git commit -m "Launch scarcinality.com"
git branch -M main
git remote add origin https://github.com/<your-username>/scarcinality-site.git
git push -u origin main
```

**2. Create the Railway service.**

- In Railway, choose **New Project -> Deploy from GitHub repo** and pick `scarcinality-site`.
- Railway auto-detects Node, runs `npm install` (nothing to install), then `npm start`.
- The server reads Railway's `PORT` automatically. No environment variables are required.
- Once the deploy is green, open the generated `*.up.railway.app` URL to confirm it serves.

**3. Point scarcinality.com at it.**

- In the service, go to **Settings -> Networking -> Custom Domain** and add `scarcinality.com` (and `www.scarcinality.com` if you want both).
- Railway will display the exact DNS record to create. Add that record at your domain registrar:
  - For `www`, this is normally a **CNAME** to the target Railway shows.
  - For the bare apex `scarcinality.com`, use the record type Railway specifies. If your registrar supports **ALIAS/ANAME** or CNAME flattening, point it at the Railway target; otherwise the common pattern is to host `www` on Railway and set the apex to redirect to `www`.
- DNS can take anywhere from a few minutes to a few hours to propagate. Railway issues the TLS certificate automatically once it sees the record.

Always follow the exact record shown in the Railway dashboard, since it is generated for your specific service.

## Adding posts

Each page is a standalone HTML file that copies the same header and footer. To add a theory post or a dispatch, duplicate `theory-01.html`, change the `<title>`, `<h1>`, meta description, and body, then link it from `theory.html` or `dispatches.html`. Keep the house style: no em dashes.

## The author photo

The About page (`/about`) shows a "JP" monogram by default. To use a real headshot, drop a square image at `public/assets/author.jpg` and it will appear automatically, replacing the monogram. No code change needed.

## Notes

- The dispatches make conditional, dated predictions and track them in the standing ledger. Update that table as data moves, rather than rewriting history.
- The treatise page is generated from the source manuscript; if you revise the manuscript, regenerate the page so the two stay in sync.
