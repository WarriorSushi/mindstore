# First-Run Checklist

Use this after a fresh install to confirm the product is actually working.

## Before Opening the App

- Database migrations have completed successfully with `npm run migrate`.
- `DATABASE_URL` points at the database you expect.
- At least one provider is configured if you want semantic features immediately.

## First 10 Minutes

1. Open the app.
2. Import one small source.
3. Search for a phrase you know exists in that source.
4. Open Chat and ask a question that should cite the imported content.
5. Open `/api/health` and confirm the database is healthy.

## Public Instance Check

- Sign in as one user and import test data.
- Sign out and sign in as a different user.
- Confirm the second account does not see the first account's memories, chats, or notifications.

## If Something Looks Wrong

- Re-run `npm run migrate`.
- Confirm the deployment is not using single-user fallback when you expect multi-user isolation.
- Check provider settings before assuming search or chat is broken.
