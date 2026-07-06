require('dotenv').config();

const express = require('express');
const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const bot = new Telegraf(process.env.BOT_TOKEN);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

console.log("🚀 MOSTI LOGISTICS SYSTEM STARTED");

// ======================
// START
// ======================

bot.start((ctx) => {
    ctx.reply("MOSTI бот активен 🚀");
});

// ======================
// PARSER + SAVE ORDER
// ======================

bot.on('text', async (ctx) => {

    const text = ctx.message.text;
    console.log("RAW MESSAGE:", text);

    try {

        // ❌ убираем мусор (гарантийные талоны и прочее)
        const cleanedText = text
            .replace(/гар\.?\s*талон.*$/i, '')
            .replace(/гарантийный\s*талон.*$/i, '')
            .trim();

        // 📞 ищем телефон (к.т., к т, к.т. и т.д.)
        const phoneMatch = cleanedText.match(
            /(?:к\.?\s*т\.?|контакт(?:ный)?\s*тел(?:ефон)?\.?)\s*[:\-]?\s*([\d\s+]+)/i
        );

        const phone = phoneMatch
            ? phoneMatch[1].replace(/\s/g, '')
            : null;

        // ➖ делим по структуре
        const parts = cleanedText.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;
        const location = parts[2] || null;

        // 🏙 город
        let city = null;
        if (location) {
            const match = location.match(/г\.?\s*([^,]+)/i);
            if (match) city = match[1].trim();
        }

        // 📦 товар
        let product = parts[3] || null;

        if (product) {
            product = product
                .replace(/гар\.?\s*талон.*/i, '')
                .replace(/прошу.*$/i, '')
                .trim();
        }

        // 💾 запись в Supabase
        const { error } = await supabase
            .from('Orders')
            .insert([
                {
                    order_number,
                    customer_name,
                    city,
                    address: location,
                    phone,
                    product,
                    status: "Собирается на складе."
                }
            ]);

        if (error) {
            console.log("SUPABASE ERROR:", error);
            return ctx.reply("❌ Ошибка сохранения заявки");
        }

        return ctx.reply("✅ Заявка принята");

    } catch (err) {
        console.log("PARSE ERROR:", err);
        return ctx.reply("❌ Ошибка обработки заявки");
    }
});

// ======================
// WEBHOOK
// ======================

app.post('/api/telegram/webhook', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error("WEBHOOK ERROR:", err);
        res.sendStatus(500);
    }
});

// ======================
// HEALTH CHECK
// ======================

app.get('/', (req, res) => {
    res.send('MOSTI server is running 🚀');
});

// ======================
// START SERVER
// ======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    try {
        await bot.telegram.setWebhook(
            'https://mosti-bot.onrender.com/api/telegram/webhook'
        );

        console.log("Webhook установлен успешно ✅");

    } catch (err) {
        console.error("Webhook error:", err);
    }
});