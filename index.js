const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const express = require('express');

// --- CONFIGURATION ---
// Inhe Render ke 'Environment Variables' mein set karna best hai
const BOT_TOKEN = process.env.BOT_TOKEN || '8550027283:AAFFLvVwZ6MwxPVGSRpHUxiRWdagE0EPtr4'; 
const apiKey = process.env.apiKey || "AIzaSyB__S4pK4zbiOQ4K5Rbu-158mCN9XLLcAo"; 
const CHANNEL_ID = '@abcde_officia'; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- EXPRESS SERVER (For Render Keep-Alive) ---
// Ye code Render ko batata hai ki bot active hai
app.get('/', (req, res) => {
  res.send('Bot is Alive and Running! 🚀');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web Server started on port ${PORT}`);
});

// --- AI LOGIC WITH EXPONENTIAL BACKOFF ---
async function getAIResponse(userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [{ text: userPrompt }]
    }],
    systemInstruction: {
      parts: [{ text: "Jab bhi main 'today current affair' likhun, toh mujhe sirf us din ke top 5 current affairs provide karo. Response mein niche diye gaye rules follow hone chahiye:\n\nKoi introductory ya closing text nahi hona chahiye (bilkul direct start karo).\n\nHar point ke shuru mein number (1️⃣, 2️⃣...) hona chahiye.\n\nHar point ke baad ek relevant emoji use karo.\n\nDo points ke beech mein ek line ka space rakho taaki wo Telegram par saaf dikhe.\n\nLanguage Hinglish rakho." }]
    }
  };

  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand that.";

    } catch (error) {
      if (i === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// --- COMMON FUNCTION FOR POSTING ---
async function postDailyAffairs() {
  console.log("Auto-posting current affairs...");
  try {
    const aiResponse = await getAIResponse("today current affair");
    await bot.telegram.sendMessage(CHANNEL_ID, aiResponse);
    console.log("Successfully posted to channel!");
  } catch (error) {
    console.error("Auto-post error:", error);
  }
}

// --- AUTOMATION (CRON JOBS) ---
// Schedule: 06:00, 12:00, 18:00, aur 00:00 (India Time)
cron.schedule('0 0,6,12,18 * * *', () => {
  postDailyAffairs();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// --- TELEGRAM COMMANDS ---
bot.start((ctx) => {
  ctx.reply('Namaste! Aapka AI Bot active hai. Render par deploy karke cron-job.org se ping karein.');
});

bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  await ctx.sendChatAction('typing');

  try {
    const aiResponse = await getAIResponse(userMessage);
    await ctx.reply(aiResponse);

    // Manual trigger check
    if (userMessage.toLowerCase() === 'today current affair') {
      await bot.telegram.sendMessage(CHANNEL_ID, aiResponse);
      await ctx.reply("✅ Channel par post kar diya gaya!");
    }
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply("Kuch technical issue aa gaya hai.");
  }
});

// --- LAUNCH ---
bot.launch()
  .then(() => console.log('Bot successfully launched!'))
  .catch((err) => console.error('Launch Error:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));