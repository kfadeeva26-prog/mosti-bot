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
// TELEGRAM BOT
// ======================
const bot = new Telegraf(process.env.BOT_TOKEN);

console.log("🚀 MOSTI SYSTEM STARTED");

// ======================
// START COMMAND
// ======================
bot.start((ctx) => {
    ctx.reply("MOSTI бот активен 🚀");
});

// ======================
// TELEGRAM MESSAGE HANDLER
// ======================
bot.on('text', async (ctx) => {
    try {
        const text = ctx.message.text;

        console.log("📩 RAW MESSAGE:", text);

        const cleaned = text.replace(/\s+/g, ' ').trim();

        // PHONE EXTRACTION
        const phoneMatches = cleaned.match(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g);

        let phones = null;
        if (phoneMatches) {
            phones = phoneMatches
                .map(p => p.replace(/\D/g, ''))
                .join(', ');
        }

        // SPLIT BASIC STRUCTURE
        const parts = cleaned.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;
        const location = parts[2] || null;

        const city = location;
        const address = location;

        // PRODUCT CLEANING
        let product = cleaned;

        product = product
            .replace(order_number || '', '')
            .replace(customer_name || '', '')
            .replace(location || '', '')
            .replace(phones || '', '')
            .replace(/гар\.?\s*талон.*$/gi, '')
            .replace(/гарантийный\s*талон.*$/gi, '')
            .replace(/прошу.*$/gi, '')
            .trim();

        if (!product || product.length < 2) {
            product = "Не указано";
        }

        // SAVE TO SUPABASE
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

        ctx.reply("✅ Заявка принята");

    } catch (err) {
        console.log("❌ ERROR:", err);
        ctx.reply("❌ Ошибка обработки заявки");
    }
});

// ======================
// TELEGRAM WEBHOOK ROUTE (ВАЖНО)
// ======================
app.post('/api/telegram/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// ======================
// TRACK ORDER API
// ======================
app.post('/api/track-order', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: "NO_QUERY" });
        }

        const cleanQuery = query.replace(/\D/g, '');

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
                .ilike('phone', `%${cleanQuery}%`)
                .maybeSingle();

            if (byPhone.data) result = byPhone.data;
        }

        if (!result) {
            return res.json({
                found: false,
                message: "Заказ не найден"
            });
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
// HEALTH CHECK
// ======================
app.get('/', (req, res) => {
    res.send('MOSTI SYSTEM RUNNING 🚀');
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});