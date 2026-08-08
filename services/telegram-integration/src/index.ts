import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
}

const UPLOADS_DIR = path.resolve("uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const bot = new TelegramBot(token, { polling: true });

console.log("Telegram bot started, polling for messages...");

// Very simple in-memory session tracker for now.
// Real version: this will call the api-gateway to create a session in Postgres.
interface BotSession {
  sessionId: string;
  selfiePath?: string;
}

const sessions = new Map<number, BotSession>();

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sessions.set(chatId, { sessionId: randomUUID() });
  bot.sendMessage(
    chatId,
    "Welcome! Send me a selfie and I'll show you how different hair colors and lip colors would look on you."
  );
});

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const photos = msg.photo;
  if (!photos || photos.length === 0) return;

  // Telegram sends multiple sizes; the last one is the highest resolution.
  const bestPhoto = photos[photos.length - 1];

  try {
    const fileLink = await bot.getFileLink(bestPhoto.file_id);
    const response = await fetch(fileLink);
    const buffer = Buffer.from(await response.arrayBuffer());

    const session: BotSession = sessions.get(chatId) ?? { sessionId: randomUUID() };
    const fileName = `${session.sessionId}.jpg`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, buffer);

    session.selfiePath = filePath;
    sessions.set(chatId, session);

    console.log(`Saved selfie for session ${session.sessionId} -> ${filePath}`);

    bot.sendMessage(
      chatId,
      "Got your selfie! Next, I'll let you pick a style to try on (coming soon)."
    );
  } catch (err) {
    console.error("Failed to save selfie:", err);
    bot.sendMessage(chatId, "Sorry, something went wrong saving your photo. Please try again.");
  }
});

bot.on("message", (msg) => {
  if (msg.photo) return; // already handled above
  console.log(`Message from ${msg.chat.id}: ${msg.text ?? "[non-text message]"}`);
});