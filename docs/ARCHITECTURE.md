# Salon AI Try-On App — Architecture

## 1. Overview

An AI-powered try-on platform for a salon client. Customers interact via
Telegram, get a link to a web try-on experience, see hair color / lip
color / hairstyle previews on their own selfie, and receive AI-generated
style recommendations. Results flow back into the chat and into a CRM
for follow-up marketing.

## 2. MVP Feature Scope

- Hair color try-on (high fidelity)
- Lip color try-on (high fidelity)
- Hairstyle change (inspiration mode — not photorealistic)
- AI style recommendations (face shape + skin tone based)
- CRM / customer capture

Eye makeup try-on is deferred to a later phase.

## 3. Services (monorepo)

- `services/tryon-engine` — face landmark detection, hair segmentation,
  style rendering
- `services/telegram-integration` — Telegram bot, webhook handling
- `services/api-gateway` — orchestrates the flow between Telegram,
  tryon-engine, and the database
- `packages/shared-types` — TypeScript types shared across all services

## 4. Data Flow

1. Customer messages the Telegram bot
2. Bot asks for a selfie, uploads it, creates a session
3. Customer picks a style category (hair color / lip color / hairstyle)
4. api-gateway sends a job to tryon-engine
5. tryon-engine detects face landmarks, segments hair, renders the style
6. Result image sent back to the customer in Telegram
7. Session + customer data saved to Postgres for CRM follow-up

## 5. Stack

- Backend: Node.js + TypeScript, Fastify
- Bot: Telegram Bot API
- Database: PostgreSQL
- Queue: Redis + BullMQ
- AI reasoning: Claude API (vision)