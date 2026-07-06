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
// PRODUCT NORMALIZATION
// ======================
function normalizeProduct(text) {

    let t = text.toLowerCase();

    const rules = [
        { from: /стир[\s\-]*суш/g, to: "стирально-сушильная машина" },
        { from: /машина\s*стир/g, to: "стиральная машина" },
        { from: /стир\w*/g, to: "стиральная машина" },

        { from: /хол(од)?/g, to: "холодильник" },
        { from: /мороз/g, to: "морозильник" },
        { from: /плита/g, to: "плита" },
        { from: /посудомой/g, to: "посудомоечная машина" }
    ];

    for (const rule of rules) {
        t = t.replace(rule.from, rule.to);
    }

    // вернуть с нормальной капитализацией
    return t
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// ======================
// PRODUCT EXTRACTOR
// ======================
function extractProduct(text, order_number, customer_name, location, phones) {

    let result = text;

    if (order_number) result = result.replace(order_number, '');
    if (customer_name) result = result.replace(customer_name, '');
    if (location) result = result.replace(location, '');

    if (phones) {
        phones.split(', ').forEach(p => {
            result = result.replace(p, '');
        });
    }

    result = result
        .replace(/гар\.?\s*талон.*$/gi, '')
        .replace(/гарантийный\s*талон.*$/gi, '')
        .replace(/прошу.*$/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!result || result.length < 2) return "Не указано";

    return normalizeProduct(result);
}

// ======================
// PARSER
// ======================
bot.on('text', async (ctx) => {

    const text = ctx.message.text;

    try {

        const normalized = text
            .replace(/\s+/g, ' ')
            .trim();

        const cleaned = normalized
            .replace(/гар\.?\s*талон.*$/gi, '')
            .replace(/гарантийный\s*талон.*$/gi, '')
            .replace(/прошу.*$/gi, '')
            .trim();

        // PHONES
        const phoneMatches = cleaned.match(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g);

        let phones = null;
        if (phoneMatches) {
            phones = phoneMatches
                .map(p => p.replace(/\D/g, ''))
                .join(', ');
        }

        // SPLIT
        const parts = cleaned.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;
        const location = parts[2] || null;

        const city = location || null;
        const address = location || null;

        // PRODUCT
        let product = extractProduct(
            cleaned,
            order_number,
            customer_name,
            location,
            phones
        );

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
// SERVER
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