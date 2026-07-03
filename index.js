require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

// запуск бота
bot.start((ctx) => {
  ctx.reply('MOSTI запущен 🚀');
});

// обработка сообщений
bot.on('text', (ctx) => {
  console.log('Сообщение:', ctx.message.text);
  ctx.reply('Заявка получена ✅');
});

// webhook (пока заглушка)
app.post('/webhook', (req, res) => {
  console.log('Webhook:', req.body);
  res.sendStatus(200);
});

bot.launch();

app.listen(3000, () => {
  console.log('Server running on port 3000');
});