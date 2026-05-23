# Team Name — Game Name

CSC 667 Term Project — Spring 2026

## Team Members

| Name | GitHub | Email |
|------|--------|-------|
| Akim Tarasov | AkimT13 | atarasov@sfsu.edu |
| Mason Lee | mlee82 | mlee82@sfsu.edu |
| Mohammed Deeb | MohammedDeeb261 | mdeeb@sfsu.edu |
| Member 4 | @username | email@sfsu.edu |

## Setup

```bash
npm install

```
Make a .env file and fill this stuff out:
PORT=
DATABASE_URL=yourdburl
SESSION_SECRET=change-me
NODE_ENV=development




```bash
npm install
npm run migrate
npm run dev

```

## URL
https://term-project-deeb-lee-li-tarasov.onrender.com

## Known limitations

- Chat feature is bugged, often displayed name as null
- Theres no private card reveal notifications after a suggestion (big one)
- Board is much simpler than real game, basically a fixed path.


## Scripts

- `npm run dev` — Start development server with hot reload
- `npm run build` — Compile TypeScript
- `npm start` — Run compiled server
- `npm run lint` — Check for lint errors
- `npm run lint:fix` — Auto-fix lint errors
- `npm run format` — Format code with Prettier
- `npm run migrate` - applys migration files
