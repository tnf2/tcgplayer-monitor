# TCGPlayer Price Monitor Bot

Discord bot that monitors TCGPlayer product listings and DMs you when prices drop below your target.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your bot token, client ID, and guild ID
3. `npm run register` — register slash commands
4. `npm start` — run the bot

## Commands

- `/add-monitor url:<tcgplayer-url> max_price:<number>` — Start monitoring a product
- `/list-monitors` — View your monitors
- `/remove-monitor id:<number>` — Delete a monitor
- `/pause-monitor id:<number>` — Pause a monitor
- `/resume-monitor id:<number>` — Resume a monitor

## How It Works

Every 90 seconds, the bot checks all active monitors against the TCGPlayer API. It filters for Near Mint, standard listings (no custom/foreign cards) at or below your max price, and DMs you with details. Each listing is only alerted once.
