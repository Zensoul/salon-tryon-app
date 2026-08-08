import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
}

const bot = new TelegramBot(token, { polling: true });

console.log("Telegram bot started, polling for messages...");

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Welcome! Send me a selfie and I'll show you how different hair colors and lip colors would look on you."
  );
});

bot.on("message", (msg) => {
  console.log(`Message from ${msg.chat.id}: ${msg.text ?? "[non-text message]"}`);
});