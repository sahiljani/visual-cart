# VisualCart Shopify App

Shopify app for managing the Shoppable Video Carousel premium feature.

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials
2. Run `npm install`
3. Run `npx prisma generate && npx prisma migrate dev`
4. Run `npm run dev`

## Deployment

Push to `main` branch to trigger automatic deployment via GitHub Actions.

### GitHub Secrets Required

Add these secrets in your GitHub repository settings:

- `SERVER_HOST`: Your server IP (e.g., 172.245.126.174)
- `SERVER_USER`: janisahil-visualcart
- `SERVER_PASSWORD`: Your SSH password

## Features

- $10/month subscription via Shopify Billing API
- Automatic metafield management for feature gating
- Webhook handling for subscription status changes
