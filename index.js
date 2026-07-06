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
// ROUTES (ГРАФИК)
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
// CITY → REGION MAP
// =======================

function getRegion(city) {
    if (!city) return null;

    const c = city.toLowerCase().trim();

    const map = {
        "минск": "minsk",

        "витебск": "vitebsk",
        "могилев": "mogilev",
        "могилёв": "mogilev",

        "гродно": "grodno",
        "брест": "brest",
        "гомель": "gomel"
    };

    return map[c] || null;
}

// =======================
// REGION → DELIVERY DAY
// =======================

function getDeliveryDay(region) {
    if (!region) return null;

    for (const [day, regions] of Object.entries(ROUTES)) {
        if (regions.includes(region)) {
            return day;
        }
    }

    return null;
}

// =======================
// CURRENT DAY
// =======================

function getToday() {
    return new Date()
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toLowerCase();
}

// =======================
// STATUS ENGINE
// =======================

function getStatus(order) {

    const region = getRegion(order.city);
    const deliveryDay = getDeliveryDay(region);

    const today = getToday();

    // если не нашли город
    if (!deliveryDay) {
        return "Собирается на складе.";
    }

    // если сегодня день доставки
    if (today === deliveryDay) {
        return "Доставка ожидается сегодня. Водитель скоро свяжется.";
    }

    // если доставка позже
    const daysOrder = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 0
    };

    if (daysOrder[today] < daysOrder[deliveryDay]) {
        return "Собирается на складе.";
    }

    // если день уже прошёл → перенос
    return "Заказ передан в доставку.";
}

// =======================
// BOT (ПРИЁМ ЗАЯВОК)
// =======================

bot.start((ctx) => {
    ctx.reply("MOSTI бот активен 🚀");
});

bot.on('text', async (ctx) => {

    const text = ctx.message.text;

    try {

        const parts = text.split(' - ').map(p => p.trim());

        const order_number = parts[0] || null;
        const customer_name = parts[1] || null;

        let location = parts[2] || null;
        let city = null;

        if (location) {
            const match = location.match(/г\.\s*([^,]+)/i);
            if (match) city = match[1].trim();
        }

        const product = parts[4] || null;

        const { data, error } = await supabase
            .from('Orders')
            .insert([
                {
                    order_number,
                    customer_name,
                    city,
                    product,
                    status: "Собирается на складе.",
                    raw_text: text
                }
            ]);

        if (error) {
            console.log(error);
            return ctx.reply("❌ Ошибка сохранения");
        }

        ctx.reply("✅ Заявка принята");

    } catch (err) {
        console.log(err);
        ctx.reply("❌ Ошибка обработки");
    }
});

// =======================
// API ДЛЯ САЙТА
// =======================

app.get('/api/status/:order_number', async (req, res) => {

    const order_number = req.params.order_number;

    const { data, error } = await supabase
        .from('Orders')
        .select('*')
        .eq('order_number', order_number)
        .single();

    if (error || !data) {
        return res.json({
            success: false,
            message: "Заявка не найдена"
        });
    }

    const status = getStatus(data);

    return res.json({
        success: true,
        order_number: data.order_number,
        customer_name: data.customer_name,
        city: data.city,
        product: data.product,
        status: status
    });
});

// =======================
// SERVER START
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});