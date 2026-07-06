require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

console.log("🚀 MOSTI API STARTED");

// ======================
// TRACK ORDER API (САЙТ)
// ======================
app.post('/api/track-order', async (req, res) => {
    try {

        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                error: "NO_QUERY"
            });
        }

        const cleanQuery = query.replace(/\s+/g, '').replace(/\D/g, '');

        let result = null;

        // 1. поиск по номеру заказа
        const byOrder = await supabase
            .from('Orders')
            .select('*')
            .eq('order_number', query)
            .maybeSingle();

        if (byOrder.data) {
            result = byOrder.data;
        }

        // 2. поиск по телефону
        if (!result) {
            const byPhone = await supabase
                .from('Orders')
                .select('*')
                .ilike('phone', `%${cleanQuery}%`)
                .maybeSingle();

            if (byPhone.data) {
                result = byPhone.data;
            }
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

        return res.status(500).json({
            error: "SERVER_ERROR"
        });
    }
});

// ======================
// HEALTH CHECK
// ======================
app.get('/', (req, res) => {
    res.send('MOSTI TRACKING API RUNNING 🚀');
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});