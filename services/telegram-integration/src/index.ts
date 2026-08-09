import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { HAIR_COLOR_OPTIONS } from "./styles.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
}

const API_GATEWAY_URL = process.env.API_GATEWAY_URL ?? "http://localhost:4000";

const UPLOADS_DIR = path.resolve("uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const bot = new TelegramBot(token, { polling: true });

console.log("Telegram bot started, polling for messages...");

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
    "Welcome! Send me a selfie and I'll show you how different hair colors would look on you."
  );
});

async function pollJobUntilDone(jobId: string, maxAttempts = 10): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${API_GATEWAY_URL}/tryon/${jobId}`);
    const data = await res.json();
    if (data.status === "completed" || data.status === "failed") {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Job did not complete in time");
}

// Step 1: receive selfie, save it, show color picker buttons.
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const photos = msg.photo;
  if (!photos || photos.length === 0) return;

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

    const keyboard = {
      inline_keyboard: chunk(
        HAIR_COLOR_OPTIONS.map((opt) => ({
          text: opt.label,
          callback_data: `haircolor:${opt.id}`,
        })),
        2
      ),
    };

    bot.sendMessage(chatId, "Got your selfie! Pick a hair color to try on:", {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error("Failed to save selfie:", err);
    bot.sendMessage(chatId, "Sorry, something went wrong. Please try again.");
  }
});

// Step 2: handle color button press, run the try-on, send result photo.
bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId || !query.data?.startsWith("haircolor:")) return;

  const colorId = query.data.replace("haircolor:", "");
  const colorOption = HAIR_COLOR_OPTIONS.find((opt) => opt.id === colorId);
  if (!colorOption) return;

  const session = sessions.get(chatId);
  if (!session?.selfiePath) {
    bot.answerCallbackQuery(query.id, { text: "Please send a selfie first." });
    return;
  }

  bot.answerCallbackQuery(query.id, { text: `Rendering ${colorOption.label}...` });
  bot.sendMessage(chatId, `Rendering ${colorOption.label}, one moment...`);

  try {
    const submitRes = await fetch(`${API_GATEWAY_URL}/tryon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        sourceImagePath: session.selfiePath,
        style: {
          styleId: `hair_color_${colorOption.id}`,
          category: "hair_color",
          targetColor: colorOption.hex,
        },
      }),
    });
    const submitData = await submitRes.json();
    const result = await pollJobUntilDone(submitData.jobId);

    if (result.status === "completed") {
      const renderedImagePath = result.result.render.outputImagePath;
      if (renderedImagePath !== session.selfiePath && fs.existsSync(renderedImagePath)) {
        await bot.sendPhoto(chatId, renderedImagePath, {
          caption: `${colorOption.label} — here's your try-on!`,
        });
      } else {
        bot.sendMessage(chatId, "Try-on completed but rendering failed. Please try again.");
      }
    } else {
      bot.sendMessage(chatId, "Sorry, the try-on failed. Please try again.");
    }
  } catch (err) {
    console.error("Failed to process color try-on:", err);
    bot.sendMessage(chatId, "Sorry, something went wrong. Please try again.");
  }
});

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

bot.on("message", (msg) => {
  if (msg.photo) return;
  console.log(`Message from ${msg.chat.id}: ${msg.text ?? "[non-text message]"}`);
});