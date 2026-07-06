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
        console.log("📩 RAW MESSAGE:", text);

        const cleaned = text.replace(/\s+/g, ' ').trim();

        // ======================
        // PHONE
        // ======================
        const phoneMatches = cleaned.match(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g);

        let phones = null;
        if (phoneMatches) {
            phones = phoneMatches
                .map(p => p.replace(/\D/g, ''))
                .filter(p => p.length >= 9)
                .join(', ');
        }

        // ======================
        // SPLIT BASE
        // ======================
        const parts = cleaned.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;

        let rest = parts.slice(2).join(' - ') || cleaned;

        // ======================
        // ADDRESS (СТАБИЛЬНО)
        // ======================
        let address = rest
            .replace(/товар\s*:?.*$/i, '')
            .replace(/к\.?\s*т\.?.*$/gi, '')
            .replace(/контактн.*телефон.*/gi, '')
            .replace(/дополнительн.*номер.*/gi, '')
            .replace(/гар\.?\s*талон.*$/gi, '')
            .replace(/гарантийн.*талон.*$/gi, '')
            .replace(/прошу.*$/gi, '')
            .trim();

        const city = address;

        // ======================
        // PRODUCT (СТАБИЛЬНО + НЕ ЛОМАЕТСЯ)
        // ======================
        let product = "";

        const productMatch = cleaned.match(/товар\s*:?\s*(.+)/i);

        if (productMatch) {
            product = productMatch[1];
        } else {
            const techMatch = cleaned.match(
                /(машина\s+стир(?:-| )?суш.*|машина\s+стиральная.*|холодильник.*|телевизор.*|пылесос.*|духовой\s+шкаф.*|варочная\s+панель.*|кондиционер.*|морозильник.*)/i
            );

            if (techMatch) {
                product = techMatch[0];
            }
        }

        product = product
            .replace(/гар\.?\s*талон.*$/i, "")
            .replace(/гарантийн.*талон.*$/i, "")
            .replace(/прошу.*$/i, "")
            .replace(/\s{2,}/g, " ")
            .trim();

        if (!product) {
            product = rest;
        }

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
                status: "Собирается на складе.",
                created_at: new Date().toISOString()
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
// AUTO CLOSE (24 часа)
// ======================
setInterval(async () => {
    try {
        const { data } = await supabase
            .from('Orders')
            .select('*')
            .neq('status', 'Заказ доставлен');

        if (!data) return;

        const now = new Date();

        for (const order of data) {
            const created = new Date(order.created_at);
            const diffHours = (now - created) / (1000 * 60 * 60);

            if (diffHours >= 24) {
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
// WEBHOOK
// ======================
app.post('/api/telegram/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
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