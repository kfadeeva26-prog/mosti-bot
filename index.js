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

// Команда /start
bot.start((ctx) => {
    ctx.reply('MOSTI бот активен 🚀');
});

// Ответ на любое текстовое сообщение
bot.on('text', async (ctx) => {

    const text = ctx.message.text;

    const { error } = await supabase
        .from('orders')
        .insert([
            {
                raw_text: text
            }
        ]);

    if (error) {
        console.log(error);
        return ctx.reply("❌ Ошибка сохранения заявки.");
    }

    ctx.reply("✅ Заявка принята.");
});
});

// Webhook
app.post('/api/telegram/webhook', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

// Проверка сервера
app.get('/', (req, res) => {
    res.send('MOSTI server is running 🚀');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    try {
        await bot.telegram.setWebhook(
            'https://mosti-bot.onrender.com/api/telegram/webhook'
        );
        console.log('Webhook установлен успешно ✅');
    } catch (err) {
        console.error('Ошибка установки webhook:', err);
    }
})