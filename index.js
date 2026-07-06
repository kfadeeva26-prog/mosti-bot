require('dotenv').config();

const express = require('express');
const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// ======================
// SUPABASE
// ======================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ======================
// BOT
// ======================
const bot = new Telegraf(process.env.BOT_TOKEN);

console.log("🚀 MOSTI SYSTEM STARTED");

// ======================
// START
// ======================
bot.start((ctx) => {
    ctx.reply("MOSTI бот активен 🚀");
});

// ======================
// MESSAGE HANDLER
// ======================
bot.on('text', async (ctx) => {
    try {
        const text = ctx.message.text;
        console.log("📩 RAW:", text);

        const cleaned = text.replace(/\s+/g, ' ').trim();

        // ======================
        // PHONES
        // ======================
        const phoneMatches = cleaned.match(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g);

        let phones = null;
        if (phoneMatches) {
            phones = phoneMatches.map(p => p.replace(/\D/g, '')).join(', ');
        }

        // ======================
        // BASIC SPLIT
        // ======================
        const parts = cleaned.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;
        const location = parts[2] || null;

        const city = location;
        const address = location;

        // ======================
        // PRODUCT EXTRACTION (ЖЁСТКО ТОЛЬКО ТЕХНИКА)
        // ======================
        const TECH = [
            'lg','samsung','bosch','indesit','whirlpool','beko','haier',
            'холодильник','стиральная','сушильная','посудомоечная',
            'машина','телевизор','плита','духовка','морозильник'
        ];

        let product = cleaned;

        product = product
            .replace(order_number || '', '')
            .replace(customer_name || '', '')
            .replace(location || '', '')
            .replace(phones || '', '')
            .replace(/к\.?\s*т\.?.*$/gi, '')
            .replace(/контактн.*телефон.*$/gi, '')
            .replace(/дополнительн.*номер.*$/gi, '')
            .replace(/гар\.?\s*талон.*$/gi, '')
            .replace(/гарантийн.*талон.*$/gi, '')
            .replace(/на\s*(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье).*/gi, '')
            .replace(/прошу.*$/gi, '')
            .trim();

        let chunks = product.split(',').map(p => p.trim());

        let found = chunks.find(p =>
            TECH.some(k => p.toLowerCase().includes(k))
        );

        if (!found) {
            found = chunks.find(p => p.length > 5);
        }

        product = found || "Не указано";

        // ======================
        // SAVE
        // ======================
        const { error } = await supabase
            .from('Orders')
            .insert([{
                order_number,
                customer_name,
                city,
                address,
                phone: phones,
                product,
                status: "Собирается на складе."
            }]);

        if (error) {
            console.log("❌ SUPABASE ERROR:", error);
            return ctx.reply("❌ Ошибка сохранения заявки");
        }

        return ctx.reply("✅ Заявка принята");

    } catch (err) {
        console.log("❌ ERROR:", err);
        return ctx.reply("❌ Ошибка обработки заявки");
    }
});

// ======================
// WEBHOOK
// ======================
app.post('/api/telegram/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// ======================
// TRACK
// ======================
app.post('/api/track-order', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) return res.status(400).json({ error: "NO_QUERY" });

        const clean = query.replace(/\D/g, '');

        let result = null;

        const byOrder = await supabase
            .from('Orders')
            .select('*')
            .eq('order_number', query)
            .maybeSingle();

        if (byOrder.data) result = byOrder.data;

        if (!result) {
            const byPhone = await supabase
                .from('Orders')
                .select('*')
                .ilike('phone', `%${clean}%`)
                .maybeSingle();

            if (byPhone.data) result = byPhone.data;
        }

        if (!result) {
            return res.json({ found: false, message: "Заказ не найден" });
        }

        return res.json({
            found: true,
            order_number: result.order_number,
            status: result.status,
            city: result.city,
            address: result.address,
            product: result.product
        });

    } catch (err) {
        console.log("TRACK ERROR:", err);
        return res.status(500).json({ error: "SERVER_ERROR" });
    }
});

// ======================
// HEALTH
// ======================
app.get('/', (req, res) => {
    res.send('MOSTI SYSTEM RUNNING 🚀');
});

// ======================
// START
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});