require('dotenv').config();

const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

console.log("🚀 STARTING BOT IN POLLING MODE");

const bot = new Telegraf(process.env.BOT_TOKEN);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

bot.start((ctx) => {
    console.log("START COMMAND");
    ctx.reply('MOSTI бот активен 🚀');
});

bot.on('text', async (ctx) => {

    console.log("🔥 MESSAGE RECEIVED");
    console.log(ctx.message.text);

    try {
        const { data, error } = await supabase
            .from('orders')
            .insert([
                {
                    raw_text: ctx.message.text
                }
            ])
            .select();

        console.log("SUPABASE:", data, error);

        if (error) {
            return ctx.reply("❌ Ошибка сохранения заявки.");
        }

        ctx.reply("✅ Заявка принята.");

    } catch (err) {
        console.log("ERROR:", err);
        ctx.reply("❌ Ошибка сервера.");
    }
});

bot.launch()
    .then(() => console.log("🤖 BOT STARTED (POLLING ACTIVE)"))
    .catch(err => console.log("BOT ERROR:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));