require('dotenv').config();

const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

console.log("🚀 MOSTI CRM STARTED");

const bot = new Telegraf(process.env.BOT_TOKEN);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// =======================
// ROUTES ENGINE
// =======================

const ROUTES = {
    monday: ["vitebsk", "mogilev", "minsk_region"],
    tuesday: ["grodno"],
    wednesday: ["brest", "minsk_region"],
    thursday: [],
    friday: ["gomel", "minsk_region"],
    saturday: [],
    sunday: []
};

// =======================
// NORMALIZE
// =======================

function normalize(text) {
    if (!text) return null;
    return text.toLowerCase().trim();
}

// =======================
// GET DAY FROM CITY
// =======================

function getDeliveryDay(city) {
    const c = normalize(city);

    const map = {
        "минск": "minsk_region",
        "минская область": "minsk_region",

        "витебск": "vitebsk",
        "могилев": "mogilev",
        "могилёв": "mogilev",

        "гродно": "grodno",
        "брест": "brest",
        "гомель": "gomel"
    };

    const region = map[c];
    if (!region) return null;

    for (const [day, regions] of Object.entries(ROUTES)) {
        if (regions.includes(region)) {
            return day;
        }
    }

    return null;
}

// =======================
// PARSER (REAL LOGISTICS FORMAT)
// =======================

function parseOrder(text) {

    const parts = text.split(' - ').map(p => p.trim());

    const order_number = parts[0] || null;
    const customer_name = parts[1] || null;

    let location = parts[2] || null;
    let phones = parts[3] || null;
    let product = parts[4] || null;
    let comment = parts.slice(5).join(' ') || null;

    let city = null;
    let phone = null;

    // город
    if (location) {
        const match = location.match(/г\.\s*([^,]+)/i);
        if (match) city = match[1].trim();
    }

    // телефон
    if (phones) {
        const match = phones.match(/375\d{9}/);
        if (match) phone = match[0];
    }

    // принудительный день
    let forcedDay = null;

    const lower = text.toLowerCase();

    if (lower.includes("понедельник")) forcedDay = "monday";
    if (lower.includes("вторник")) forcedDay = "tuesday";
    if (lower.includes("среда")) forcedDay = "wednesday";
    if (lower.includes("четверг")) forcedDay = "thursday";
    if (lower.includes("пятницу")) forcedDay = "friday";

    return {
        order_number,
        customer_name,
        city,
        phone,
        product,
        comment,
        forcedDay
    };
}

// =======================
// BOT
// =======================

bot.start((ctx) => {
    ctx.reply("MOSTI бот активен 🚀");
});

bot.on('text', async (ctx) => {

    const text = ctx.message.text;

    console.log("📩 RAW:", text);

    try {

        const parsed = parseOrder(text);

        console.log("📦 PARSED:", parsed);

        const delivery_day = parsed.forcedDay || getDeliveryDay(parsed.city);

        const { data, error } = await supabase
            .from('Orders')
            .insert([
                {
                    order_number: parsed.order_number,
                    customer_name: parsed.customer_name,
                    city: parsed.city,
                    address: parsed.comment,
                    phone: parsed.phone,
                    product: parsed.product,
                    status: "Принята в обработку",
                    raw_text: text,
                    planned_delivery: delivery_day
                }
            ])
            .select();

        if (error) {
            console.log("❌ DB ERROR:", error);
            return ctx.reply("❌ Ошибка сохранения заявки");
        }

        console.log("✅ SAVED:", data);

        ctx.reply("✅ Заявка принята");

    } catch (err) {
        console.log("❌ ERROR:", err);
        ctx.reply("❌ Ошибка сервера");
    }
});

// =======================
// START
// =======================

bot.launch()
    .then(() => console.log("🤖 MOSTI CRM RUNNING"))
    .catch(err => console.log("BOT ERROR:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));