const { Telegraf } = require("telegraf");
const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

const TOKEN = "8593912101:AAGSvp_NDwjytW5v8L4WQ2uuB__il3onrXs";
const CREATOR = "@amirwe0";
const ADMIN_ID = "8449803529";

const usersFile = "users.json";
let users = [];

// بارگیری کاربران قبلی
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

    if (!fs.existsSync("downloads")) {
      fs.mkdirSync("downloads");
    }

    const timestamp = Date.now();
    const output = `downloads/video_${timestamp}.%(ext)s`;

    const command = `yt-dlp -f "best[filesize<50M]" -o "${output}" --no-warnings "${url}"`;

    console.log(`🔧 اجرای دستور: ${command}`);
    await execPromise(command);

    const files = fs.readdirSync("downloads");
    const downloaded = files.find((f) => f.includes(`video_${timestamp}`));

    if (downloaded) {
      const filePath = `downloads/${downloaded}`;
      console.log(`✅ دانلود کامل: ${filePath}`);
      return filePath;
    }

    return null;
  } catch (error) {
    console.error(`❌ خطا در دانلود: ${error.message}`);
    return null;
  }
}

const bot = new Telegraf(TOKEN);

bot.start(async (ctx) => {
  const user = ctx.from;
  const userInfo = {
    id: user.id,
    name: `${user.first_name} ${user.last_name || ""}`.trim(),
    username: user.username || "ندارد",
    date: new Date().toISOString(),
  };

  saveUser(userInfo);
  await ctx.reply("🚀");
});

bot.command("about", (ctx) => {
  ctx.reply(`👤 سازنده: ${CREATOR}\n🤖 ربات دانلود مدیا`);
});

bot.command("stats", (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    return ctx.reply("❌ دسترسی نداری!");
  }

  const total = users.length;
  const today = new Date().toISOString().slice(0, 10);
  const todayUsers = users.filter((u) => u.date.startsWith(today)).length;

  ctx.reply(
    `📊 آمار ربات:\n\n` +
      `👥 کل کاربران: ${total}\n` +
      `📅 کاربران امروز: ${todayUsers}\n` +
      `🕒 آخرین بروزرسانی: ${new Date().toLocaleTimeString("fa-IR")}`
  );
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  const platform = getPlatform(text);

  if (!platform) return;

  const msg = await ctx.reply(`⏳ در حال دانلود از ${platform}...`);

  try {
    const filePath = await downloadMedia(text);

    if (filePath && fs.existsSync(filePath)) {
      await msg.editText(`✅ دانلود شد! در حال آپلود...`);

      const stats = fs.statSync(filePath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      if (stats.size > 50 * 1024 * 1024) {
        await msg.editText(
          `❌ فایل خیلی بزرگه (${fileSizeMB}MB)\nحداکثر مجاز: 50MB`
        );
        fs.unlinkSync(filePath);
        return;
      }

      await ctx.replyWithVideo(
        { source: filePath },
        {
          caption: `✅ از ${platform}\n📊 حجم: ${fileSizeMB}MB`,
          supports_streaming: true,
        }
      );

      await msg.delete();

      fs.unlinkSync(filePath);
      console.log(`🗑 فایل حذف شد: ${filePath}`);
    } else {
      await msg.editText("❌ خطا در دانلود فایل");
    }
  } catch (error) {
    console.error("خطای اصلی:", error);
    await msg.editText("❌ خطا! لینک رو چک کن");
  }
});

bot.catch((err, ctx) => {
  console.error("خطای ربات:", err);
  ctx.reply("❌ خطای سیستمی! دوباره امتحان کن");
});

console.log("🤖 ربات در حال راه‌اندازی...");
bot
  .launch()
  .then(() => {
    console.log("✅ ربات با موفقیت شروع به کار کرد!");
    console.log(`👤 سازنده: ${CREATOR}`);
  })
  .catch((err) => {
    console.error("❌ خطا در راه‌اندازی:", err);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
