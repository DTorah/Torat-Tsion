# Torat Tsion backend

Standalone Node runtime for the Expo app API. It preserves `/api/recordings`, private audio streaming with HTTP Range support, cover reads/mutations, and admin login.

## Server environment

Copy `backend/.env.example` to a server-side environment configuration. Do not copy it into the Expo project or commit a populated version. The Expo project itself should receive only `EXPO_PUBLIC_API_URL` from the root `.env` file.

- `GOOGLE_SERVICE_ACCOUNT_JSON`: server-only service-account JSON. On Render, paste the JSON as a secret environment variable. For local development only, `TORAT_TSION_SERVICE_ACCOUNT_PATH` may point to a file outside the repository.
- `TORAT_TSION_DRIVE_FOLDER_ID`: `1JZfz7efCHWW8GbjxQ2LOkU7T0ZUy_c8` (the Torat Tsion root folder).
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`: server-only admin settings. Use a random session secret of at least 32 bytes.
- `GITHUB_CONTENTS_TOKEN`: server-only fine-grained GitHub token with **Contents: Read and write** access to `GITHUB_CONTENTS_REPOSITORY`. When configured, it stores CMS content and uploaded covers on the `GITHUB_CONTENTS_BRANCH` branch.
- `GITHUB_CONTENTS_REPOSITORY`: separate repository for durable Torat Tsion CMS content.
- `GITHUB_CONTENTS_BRANCH`: dedicated data branch. Defaults to `torat-tsion-content`; the backend creates it from `main` on first use.
- `RECORDING_TIME_ZONE`: IANA timezone used for recording timestamps embedded in filenames. Defaults to `America/New_York`.
- `TORAT_TSION_LOCATION`: configured community location label for Zmanim.
- `TORAT_TSION_ZMANIM_JSON`: server-only JSON object containing the daily Zmanim values.
- Recording dates, public titles, search, Time Frame filtering, and ordering come from recognized filename timestamps/date tokens; Drive upload and modification dates are not shown or used as recording dates.
- `TORAT_TSION_DATA_DIR`: local-development scratch directory. It is not required for durable Render storage and is only used for temporary audio analysis and the filesystem fallback when GitHub content storage is deliberately not configured.
- `PORT`: supplied by the hosting platform.

Never expose server variables through `EXPO_PUBLIC_*` variables. With GitHub content storage configured, Admin content, Featured selections, Carousel settings, category assignments, duration/Skip-to-Shiur metadata, Rabbi covers, and recording cover overrides survive Render redeploys without a paid persistent disk. The GitHub token is never returned by the API or included in the Expo client.

The web Home page requests `/api/home?summary=1` first: this reads root folders and bounded Admin-curated recording IDs without waiting for recursive library discovery. The full metadata response is loaded only when the visitor scrolls to the lower Home shelves. Drive folder listings and recursive discovery results are cached in memory for five minutes, and the duration worker reuses that discovery cache between bounded hydration batches. Parsha labels use the Hebcal calendar's diaspora reading schedule and are omitted on holiday readings.

## Local run

```bash
npm install
GOOGLE_SERVICE_ACCOUNT_JSON=... npm start
```

The service reads the local credential file when `GOOGLE_SERVICE_ACCOUNT_JSON` is absent. Do not place credentials in this repository.
