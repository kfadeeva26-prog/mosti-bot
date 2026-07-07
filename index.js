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

// ======================
// GROUP FILTER
// ======================

// в группе игнорируем обычные сообщения
if (ctx.chat.type !== 'private') {

    const isOrder =
        text.includes(' - ') &&
        /\d{5,}/.test(text);

    if (!isOrder) {
        return;
    }
}
        console.log("📩 RAW MESSAGE:", text);

        const cleaned = text.replace(/\s+/g, ' ').trim();

        // PHONE
        const phoneMatches = cleaned.match(/(?:\+?375|80)\s*\d[\d\s\-()]{7,}/g);

        let phones = null;
        if (phoneMatches) {
            phones = phoneMatches
                .map(p => p.replace(/\D/g, ''))
                .filter(p => p.length >= 9)
                .join(', ');
        }

        // SPLIT BASE
        const parts = cleaned.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;

        let rest = parts.slice(2).join(' - ') || cleaned;

        // ADDRESS
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
        // PRODUCT (ИСПРАВЛЕННЫЙ СТАБИЛЬНЫЙ ВАРИАНТ)
        // ======================

        let product = "";

// 1. если есть "Товар:"
        const productMatch = cleaned.match(/товар\s*:?\s*(.+)/i);

        if (productMatch) {
            product = productMatch[1];
        } else {
            // 2. ищем технику только если нет адреса внутри
            const techMatch = cleaned.match(
                /(машина\s+стир(?:-| )?суш.*|машина\s*стиральная.*|холодильник.*|телевизор.*|пылесос.*|духовой\s*шкаф.*|варочная\s*панель.*|кондиционер.*|морозильник.*)/i
            );

            if (techMatch) {
                product = techMatch[0];
            }
        }

// 3. убираем мусор
        product = (product || "")
            .replace(address, '') // 🔥 ВАЖНО: убираем попадание адреса
            .replace(/гар\.?\s*талон.*$/i, "")
            .replace(/гарантийн.*талон.*$/i, "")
            .replace(/прошу.*$/i, "")
            .replace(/\s{2,}/g, " ")
            .trim();

// 4. fallback (если вообще пусто)
        if (!product || product.length < 3) {
            product = rest || cleaned;
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
// WEBHOOK
// ======================
app.post('/api/telegram/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// ======================
// TRACK ORDER API
// ======================
app.post('/api/track-order', async (req, res) => {
console.log("TRACK HIT:", req.body);
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
            .eq('order_number', String(query).trim())
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
// SERVER
// ======================
const PORT = process.env.PORT || 3000;

// ======================
// ГРАФИК + АВТОЗАКРЫТИЕ
// ======================

function getDeliveryDays(city) {
    const c = (city || "").toLowerCase();

    if (c.includes("витебск") || c.includes("могилев")) return [1];
    if (c.includes("гродно")) return [2];
    if (c.includes("брест")) return [3];
    if (c.includes("гомель")) return [5];

    if (c.includes("минск")) return [2, 4, 6];

    return [];
}

async function autoCloseBySchedule() {
    try {
        const now = new Date();
        const day = now.getDay();
        const nextDay = (day + 1) % 7;

        const { data: orders } = await supabase
            .from('Orders')
            .select('*')
            .neq('status', 'Заказ доставлен');

        if (!orders) return;

        for (const order of orders) {

            const city = order.city || "";
            const deliveryDays = getDeliveryDays(city);

            if (deliveryDays.includes(nextDay)) {

                await supabase
                    .from('Orders')
                    .update({ status: "Заказ доставлен" })
                    .eq('id', order.id);

                console.log("✅ CLOSED BY SCHEDULE:", order.order_number);
            }
        }

    } catch (err) {
        console.log("AUTO CLOSE ERROR:", err);
    }
}

autoCloseBySchedule();
setInterval(autoCloseBySchedule, 60 * 60 * 1000);

// ======================
// START SERVER
// ======================
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