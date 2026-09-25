# NIAZI TikTok Growth Website

## What it does
- NIAZI mobile-friendly TikTok Likes/Followers storefront
- Easypaisa number: 03220225993
- TikTok URL input
- Package selection
- SMM PK Panel API integration
- Provider services lookup
- Provider order ID and status lookup
- API key kept on the server, not in frontend

## Setup
1. Copy `.env.example` to `.env`.
2. Put your SMM PK Panel API key in `SMM_API_KEY`.
3. Change `ADMIN_KEY`.
4. Run:
   npm install
   npm start
5. Open http://localhost:3000

## Important
The app does NOT verify Easypaisa payments automatically. The current customer order endpoint submits the provider order immediately after the customer clicks "Place Order". If you want payment-first/manual confirmation, add an admin confirmation layer before calling the provider `add` API.

The app automatically searches the provider's `services` response for a TikTok service whose name contains "like" or "follower". Because providers can list multiple services, inspect `/api/services` before taking paid orders and, if necessary, replace `findService()` with a fixed service ID.

Never expose SMM_API_KEY in frontend JavaScript or commit `.env` to GitHub.
