require('dotenv').config();

const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const bot = new Telegraf(process.env.BOT_TOKEN);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// старт
bot.start((ctx) => {
    console.log("START");
    ctx.reply('MOSTI бот активен 🚀');
});

// все сообщения
bot.on('text', async (ctx) => {

    console.log("🔥 MESSAGE RECEIVED");
    console.log("TEXT:", ctx.message.text);

    try {
        const { data, error } = await supabase
            .from('orders')
            .insert([
                {
                    raw_text: ctx.message.text
                }
            ])
            .select();

        console.log("📦 SUPABASE RESULT");
        console.log("DATA:", data);
        console.log("ERROR:", error);

        if (error) {
            return ctx.reply("❌ Ошибка сохранения заявки.");
        }

        ctx.reply("✅ Заявка принята.");

    } catch (err) {
        console.log("❌ CRITICAL ERROR:", err);
        ctx.reply("❌ Ошибка сервера.");
    }
});

// запуск бота (ВАЖНО — polling режим)
bot.launch()
    .then(() => console.log("🤖 BOT STARTED (polling mode)"))
    .catch((err) => console.log("BOT LAUNCH ERROR:", err));

// graceful stop (нужно для Render)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));