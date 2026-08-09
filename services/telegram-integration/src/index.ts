import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
    "Welcome! Send me a selfie and I'll show you how different hair colors and lip colors would look on you."
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
    bot.sendMessage(chatId, "Got your selfie! Processing a try-on preview now...");

    // Default test style for now — real style picker (buttons) comes next.
    const submitRes = await fetch(`${API_GATEWAY_URL}/tryon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        sourceImagePath: filePath,
        style: {
          styleId: "hair_color_copper",
          category: "hair_color",
          targetColor: "#B87333",
        },
      }),
    });
    const submitData = await submitRes.json();
    console.log("Submitted job:", submitData);

    const result = await pollJobUntilDone(submitData.jobId);
    console.log("Job result:", result);

    if (result.status === "completed") {
      bot.sendMessage(
        chatId,
        `Try-on complete! (This is using placeholder AI data for now — real rendering comes next.)\n\nDetected face shape: ${result.result.landmarks.faceShape}\nEstimated undertone: ${result.result.skinTone.undertone}`
      );
    } else {
      bot.sendMessage(chatId, "Sorry, the try-on failed. Please try again.");
    }
  } catch (err) {
    console.error("Failed to process selfie:", err);
    bot.sendMessage(chatId, "Sorry, something went wrong. Please try again.");
  }
});

bot.on("message", (msg) => {
  if (msg.photo) return;
  console.log(`Message from ${msg.chat.id}: ${msg.text ?? "[non-text message]"}`);
});