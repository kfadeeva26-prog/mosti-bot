require('dotenv').config();

const express = require('express');
const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        const cleaned = text.replace(/\s+/g, ' ').trim();

        // PHONE
        const phoneMatches = cleaned.match(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g);

        let phones = null;
        if (phoneMatches) {
            phones = phoneMatches.map(p => p.replace(/\D/g, '')).join(', ');
        }

        // SPLIT
        const parts = cleaned.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;

        let rest = parts.slice(2).join(' - ') || '';

        const city = rest;

        // ======================
        // PRODUCT (СТАБИЛЬНО)
        // ======================
        let product = cleaned;

        product = product
            .replace(order_number || '', '')
            .replace(customer_name || '', '')
            .replace(rest || '', '')
            .replace(phones || '', '')
            .replace(/гар\.?\s*талон.*$/gi, '')
            .replace(/гарантийн.*талон.*$/gi, '')
            .replace(/прошу.*$/gi, '')
            .replace(/на\s*(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье).*/gi, '')
            .trim();

        if (!product || product.length < 3) {
            product = rest || "Не указано";
        }

        product = product.replace(/\s{2,}/g, ' ').trim();

        // SAVE
        const { error } = await supabase
            .from('Orders')
            .insert([{
                order_number,
                customer_name,
                city,
                address: city,
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
// WEBHOOK (ОДИН, НЕ ДВА!!!)
// ======================
app.post('/api/telegram/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// ======================
// AUTO CLOSE (через 24 часа)
// ======================
setInterval(async () => {
    try {
        const { data: orders } = await supabase
            .from('Orders')
            .select('*')
            .neq('status', 'Заказ доставлен');

        if (!orders) return;

        const now = new Date();

        for (const order of orders) {
            const created = new Date(order.created_at || now);
            const diff = (now - created) / (1000 * 60 * 60);

            if (diff >= 24) {
                await supabase
                    .from('Orders')
                    .update({ status: 'Заказ доставлен' })
                    .eq('id', order.id);

                console.log("✅ CLOSED:", order.order_number);
            }
        }

    } catch (e) {
        console.log("AUTO CLOSE ERROR:", e);
    }
}, 60 * 60 * 1000);

// ======================
// TRACK API
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