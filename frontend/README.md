# Frontend

A barebones React starter using JavaScript, plain CSS, and Vite.

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
├── public/              # Static files served as-is, such as favicon.ico
├── src/
│   ├── assets/          # Images and files imported by components
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page components as the app grows
│   ├── services/        # API calls when you're ready to connect a backend
│   ├── App.jsx          # Start building your UI here
│   ├── App.css          # Styles for App
│   ├── index.css        # Global styles
│   └── main.jsx         # Mounts React into index.html
├── .gitignore
├── index.html
├── package.json         # Dependencies and commands
├── package-lock.json    # Exact dependency versions; commit this file
└── vite.config.js       # Vite + React configuration
```

Empty folders contain `.gitkeep` so Git can track them. Remove those placeholder files once you add real files.

## Start editing

Edit `src/App.jsx` for content and `src/App.css` for styling. Add reusable components to `src/components/` when you need them. The other folders are empty placeholders; no routing or backend is configured.

## Other commands

```sh
npm run build    # Creates a production build in dist/
npm run preview  # Previews that build locally
```

Commit the source files and lockfile. Git ignores `node_modules/`, `dist/`, and local `.env` files. Frontend code is visible to users, so don't put secrets in it.
