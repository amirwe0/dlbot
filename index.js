require("dotenv").config();
const express = require("express");
const { Telegraf } = require("telegraf");
const fs = require("fs");
const util = require("util");
const { exec } = require("child_process");
const execPromise = util.promisify(exec);

const TOKEN = "8593912101:AAGSvp_NDwjytW5v8L4WQ2uuB__il3onrXs";
const CREATOR = "@amirwe0";
const ADMIN_ID = "8449803529";

if (!TOKEN) throw new Error("❌ TOKEN در محیط تعریف نشده!");

const usersFile = "users.json";
let users = [];

if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

function saveUser(user) {
  if (!users.some((u) => u.id === user.id)) {
    users.push(user);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    console.log(`👤 کاربر جدید: ${user.name} (${user.id})`);
  }
}

function getPlatform(url) {
  url = url.toLowerCase();
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  return null;
}

async function downloadMedia(url) {
  try {
    console.log(`📥 شروع دانلود: ${url}`);

    if (!fs.existsSync("downloads")) fs.mkdirSync("downloads");

    const timestamp = Date.now();
    const output = `downloads/video_${timestamp}.%(ext)s`;

    const command = `yt-dlp -f "best[filesize<50M]" -o "${output}" --no-warnings "${url}"`;

    console.log(`🔧 اجرای دستور: ${command}`);
    await execPromise(command);

    const files = fs.readdirSync("downloads");
    const downloaded = files.find((f) => f.includes(`video_${timestamp}`));

    if (downloaded) return `downloads/${downloaded}`;
    return null;
  } catch (error) {
    console.error(`❌ خطا در دانلود: ${error.message}`);
    return null;
  }
}

const bot = new Telegraf(TOKEN);

bot.start(async (ctx) => {
  const user = ctx.from;
  saveUser({
    id: user.id,
    name: `${user.first_name} ${user.last_name || ""}`.trim(),
    username: user.username || "ندارد",
    date: new Date().toISOString(),
  });

  ctx.reply("🚀 ربات روشنه!");
});

bot.command("about", (ctx) => {
  ctx.reply(`👤 سازنده: ${CREATOR}\n🤖 ربات دانلود مدیا`);
});

bot.command("stats", (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply("❌ دسترسی نداری!");

  const total = users.length;
  const today = new Date().toISOString().slice(0, 10);
  const todayUsers = users.filter((u) => u.date.startsWith(today)).length;

  ctx.reply(`📊 آمار:\n👥 کل: ${total}\n📅 امروز: ${todayUsers}`);
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  const platform = getPlatform(text);
  if (!platform) return;

  const msg = await ctx.reply(`⏳ دانلود از ${platform}...`);

  try {
    const filePath = await downloadMedia(text);
    if (filePath && fs.existsSync(filePath)) {
      await msg.editText(`✅ دانلود شد! در حال ارسال...`);

      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      if (stats.size > 50 * 1024 * 1024) {
        await msg.editText(`❌ فایل بزرگه (${sizeMB}MB)`);
        fs.unlinkSync(filePath);
        return;
      }

      await ctx.replyWithVideo(
        { source: filePath },
        { caption: `📥 از ${platform}\n📦 ${sizeMB}MB` }
      );

      fs.unlinkSync(filePath);
      await msg.delete();
    } else {
      await msg.editText("❌ خطا در دانلود!");
    }
  } catch (e) {
    await msg.editText("❌ خطا!");
  }
});

// ---------------------
//     Webhook
// ---------------------
const app = express();
app.use(express.json());

app.use(bot.webhookCallback(`/bot${TOKEN}`));

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // این بخش را بعد از ساخت Render لینک را عوض کن 👇
  bot.telegram.setWebhook(`https://YOUR-RENDER-URL.onrender.com/bot${TOKEN}`);
});
