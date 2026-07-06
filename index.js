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

// =======================
// ROUTES
// =======================

const ROUTES = {
    monday: ["vitebsk", "mogilev", "minsk"],
    tuesday: ["grodno"],
    wednesday: ["brest", "minsk"],
    thursday: [],
    friday: ["gomel", "minsk"],
    saturday: [],
    sunday: []
};

// =======================
// BOT LOGIC
// =======================

bot.start((ctx) => {
    ctx.reply("MOSTI бот активен 🚀");
});

bot.on('text', async (ctx) => {

    const text = ctx.message.text;

    try {
        const parts = text.split(' - ').map(p => p.trim());

        const order_number = parts[0];
        const customer_name = parts[1];

        let location = parts[2];
        let city = null;

        if (location) {
            const match = location.match(/г\.\s*([^,]+)/i);
            if (match) city = match[1].trim();
        }

        const product = parts[4];

        const { error } = await supabase
            .from('Orders')
            .insert([
                {
                    order_number,
                    customer_name,
                    city,
                    address: location,
                    product,
                    status: "Собирается на складе."
                }
            ]);

        if (error) {
            console.log("DB ERROR:", error);
            return ctx.reply("❌ Ошибка сохранения заявки");
        }

        ctx.reply("✅ Заявка принята");

    } catch (err) {
        console.log(err);
        ctx.reply("❌ Ошибка обработки");
    }
});

// =======================
// WEBHOOK ENDPOINT
// =======================

app.post('/api/telegram/webhook', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error("WEBHOOK ERROR:", err);
        res.sendStatus(500);
    }
});

// =======================
// HEALTH CHECK
// =======================

app.get('/', (req, res) => {
    res.send('MOSTI server is running 🚀');
});

// =======================
// START SERVER
// =======================

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