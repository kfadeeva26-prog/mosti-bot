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
// PARSER
// ======================

bot.on('text', async (ctx) => {

    const text = ctx.message.text;
    console.log("RAW MESSAGE:", text);

    try {

        // ======================
        // НОРМАЛИЗАЦИЯ
        // ======================
        const normalized = text
            .replace(/\s+/g, ' ')
            .trim();

        // ======================
        // УДАЛЕНИЕ МУСОРА
        // ======================
        const cleaned = normalized
            .replace(/гар\.?\s*талон.*$/gi, '')
            .replace(/гарантийный\s*талон.*$/gi, '')
            .replace(/прошу.*$/gi, '')
            .trim();

        // ======================
        // ТЕЛЕФОНЫ (ВСЕ)
        // ======================
        const phoneMatches = cleaned.match(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g);

        let phones = null;
        if (phoneMatches) {
            phones = phoneMatches
                .map(p => p.replace(/\D/g, ''))
                .join(', ');
        }

        // ======================
        // РАЗБИЕНИЕ
        // ======================
        const parts = cleaned.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;
        const location = parts[2] || null;

        // ======================
        // ГОРОД + ОБЛАСТЬ
        // ======================
        let city = null;

        if (location) {

            const lower = location.toLowerCase();

            const matchCity = location.match(/г\.?\s*([^,]+)/i);
            const matchVillage = location.match(/(?:г\.п\.|д\.|пос\.|рп\.)\s*([^,]+)/i);

            let place = matchCity?.[1] || matchVillage?.[1] || null;

            let region = null;

            if (lower.includes('гомель')) region = 'Гомельская область';
            else if (lower.includes('брест')) region = 'Брестская область';
            else if (lower.includes('гродно')) region = 'Гродненская область';
            else if (lower.includes('витебск')) region = 'Витебская область';
            else if (lower.includes('могилев')) region = 'Могилёвская область';
            else if (lower.includes('минск')) region = 'Минская область';

            city = [region, place].filter(Boolean).join(', ');
        }

        // ======================
        // АДРЕС
        // ======================
        let address = null;

        if (location) {

            const addrMatch = location.match(/(ул\.|улица|пр\.|просп\.|пер\.)[^,]+/i);
            const houseMatch = location.match(/д\.\s*\d+[\/\w-]*/i);
            const flatMatch = location.match(/кв\.\s*\d+/i);

            address = [addrMatch?.[0], houseMatch?.[0], flatMatch?.[0]]
                .filter(Boolean)
                .join(', ') || location;
        }

        // ======================
        // ТОВАР (ЧИСТКА)
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

        // ======================
        // SUPABASE
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