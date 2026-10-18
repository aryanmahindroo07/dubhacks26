# Mise frontend

Mise's React interface uses JavaScript, plain CSS, and Vite. It includes the home customer workspace (`/`), live overview (`/overview`), and receipt inbox (`/ai`).

## Run locally

Install Node.js 24 LTS, then run these commands from this folder:

```sh
npm install
npm run dev
```

Open the URL printed in your terminal. Saving a file updates the page automatically. Stop the server with Ctrl+C.

## Folder structure

```text
frontend/
├── public/              # Favicon, sample images, and recorded benchmark data
├── src/
│   ├── assets/          # Images and files imported by components
│   ├── components/      # Reusable UI components
│   ├── pages/           # Live overview and AI workspace pages
│   ├── services/        # API calls, caching, and prefetch coordination
│   ├── App.jsx          # Home page and customer search
│   ├── App.css          # Styles for App
│   ├── index.css        # Global styles
│   └── main.jsx         # Mounts React into index.html
├── .gitignore
├── index.html
├── package.json         # Dependencies and commands
├── package-lock.json    # Exact dependency versions; commit this file
└── vite.config.js       # Vite + React configuration
```

## Start editing

Edit `src/App.jsx` and `src/App.css` for the home page. The other pages live in `src/pages/`; the shared sidebar and top bar live in `src/components/AppLayout/`. `src/main.jsx` selects the page from the URL. Start the Express backend in `../backend/` for API features; see the [project README](../README.md) and [AI setup guide](../docs/ai-inbox-setup.md).

## Other commands

```sh
npm run build    # Creates a production build in dist/
npm run preview  # Previews that build locally
```

Commit the source files and lockfile. Git ignores `node_modules/`, `dist/`, and local `.env` files. Frontend code is visible to users, so don't put secrets in it.
