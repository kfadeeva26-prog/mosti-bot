require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());

// === Telegram Bot ===
const bot = new Telegraf(process.env.BOT_TOKEN);

// === ПРОСТАЯ ПРОВЕРКА БОТА ===
bot.start((ctx) => {
  ctx.reply('MOSTI бот активен 🚀');
});

// === ЛОВИМ ВСЕ СООБЩЕНИЯ ===
bot.on('text', (ctx) => {
  console.log('Новое сообщение:', ctx.message.text);

  ctx.reply('Сообщение получено ✔️');
});

// === WEBHOOK ДЛЯ RENDER ===
app.post('/api/telegram/webhook', (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// === ПРОВЕРКА СЕРВЕРА ===
app.get('/', (req, res) => {
  res.send('MOSTI server is running 🚀');
});

// === ЗАПУСК ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});