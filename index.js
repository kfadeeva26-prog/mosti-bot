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
// PARSER (STABLE VERSION)
// ======================
bot.on('text', async (ctx) => {

    const text = ctx.message.text;
    console.log("RAW:", text);

    try {

        // ======================
        // NORMALIZE
        // ======================
        const normalized = text
            .replace(/\s+/g, ' ')
            .trim();

        // ======================
        // CLEAN TRASH TEXT
        // ======================
        const cleaned = normalized
            .replace(/гар\.?\s*талон.*$/gi, '')
            .replace(/гарантийный\s*талон.*$/gi, '')
            .replace(/прошу.*$/gi, '')
            .trim();

        // ======================
        // PHONES (ALL)
        // ======================
        const phoneMatches = cleaned.match(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g);

        let phones = null;
        if (phoneMatches) {
            phones = phoneMatches
                .map(p => p.replace(/\D/g, ''))
                .join(', ');
        }

        // ======================
        // SPLIT STRUCTURE
        // ======================
        const parts = cleaned.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;

        // ======================
        // CITY + ADDRESS (SAME FULL TEXT)
        // ======================
        const location = parts[2] || null;

        const city = location || null;
        const address = location || null;

        // ======================
        // PRODUCT (SAFE EXTRACTION)
        // ======================
        let product = parts.slice(3).join(' - ') || null;

        if (product) {
            product = product
                .replace(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g, '')
                .replace(/к\.?\s*т\.?.*/gi, '')
                .replace(/гар\.?\s*талон.*/gi, '')
                .replace(/гарантийный\s*талон.*/gi, '')
                .replace(/прошу.*$/gi, '')
                .trim();
        }

        if (!product || product.length < 3) {
            product = "Не указано";
        }

        // ======================
        // SAVE TO SUPABASE
        // ======================
        const { error } = await supabase
            .from('Orders')
            .insert([
                {
                    order_number,
                    customer_name,
                    city,
                    address,
                    phone: phones,
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
        console.log("ERROR:", err);
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