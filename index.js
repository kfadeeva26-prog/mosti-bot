require('dotenv').config();

const express = require('express');
const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const bot = new Telegraf(process.env.BOT_TOKEN);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// START
bot.start((ctx) => {
    console.log("START command triggered");
    ctx.reply('MOSTI бот активен 🚀');
});

// ВСЕ ТЕКСТОВЫЕ СООБЩЕНИЯ
bot.on('text', async (ctx) => {

    console.log("📩 MESSAGE RECEIVED");
    console.log("TEXT:", ctx.message.text);

    try {
        const { data, error } = await supabase
            .from('orders')
            .insert([
                {
                    raw_text: ctx.message.text
                }
            ])
            .select();

        console.log("📦 SUPABASE RESPONSE:");
        console.log("DATA:", data);
        console.log("ERROR:", error);

        if (error) {
            console.log("❌ INSERT FAILED");
            return ctx.reply("❌ Ошибка сохранения заявки.");
        }

        console.log("✅ INSERT SUCCESS");
        ctx.reply("✅ Заявка принята.");

    } catch (err) {
        console.log("🔥 CRITICAL ERROR:", err);
        ctx.reply("❌ Критическая ошибка сервера.");
    }
});

// WEBHOOK
app.post('/api/telegram/webhook', async (req, res) => {

    console.log("🔥 WEBHOOK HIT");
    console.log("BODY:", req.body);

    try {
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error("WEBHOOK ERROR:", err);
        res.sendStatus(500);
    }
});

// HEALTH CHECK
app.get('/', (req, res) => {
    res.send('MOSTI server is running 🚀');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    try {
        await bot.telegram.setWebhook(
            'https://mosti-bot.onrender.com/api/telegram/webhook'
        );
        console.log('Webhook установлен успешно ✅');
    } catch (err) {
        console.error('Ошибка установки webhook:', err);
    }
});