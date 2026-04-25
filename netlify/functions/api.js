const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware
app.use(express.json());

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// ROUTES
// ============================================================

// Get all orders for admin
app.get('/admin/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('id', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      orders: data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get orders (customer view)
app.get('/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('id', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      total: data.length,
      orders: data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new order
app.post('/order', async (req, res) => {
  const { name, address, yamType, amount, price } = req.body;

  // Validate
  if (!name || !address || !yamType || !amount || !price) {
    return res.status(400).json({
      success: false,
      error: "All fields are required."
    });
  }

  const amountNum = parseFloat(amount);
  const priceNum = parseFloat(price);
  
  if (isNaN(amountNum) || amountNum <= 0 || isNaN(priceNum) || priceNum <= 0) {
    return res.status(400).json({
      success: false,
      error: "Amount and price must be positive numbers."
    });
  }

  const totalPrice = priceNum * amountNum;

  const newOrder = {
    name: name.trim(),
    address: address.trim(),
    yam_type: yamType,
    amount_kg: amountNum,
    price_per_kg: priceNum,
    total_price: totalPrice,
    status: "Pending",
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert([newOrder])
      .select();
    
    if (error) throw error;
    
    console.log(`New order created from ${name}`);
    
    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      order: {
        id: data[0].id,
        name: data[0].name,
        address: data[0].address,
        yamType: data[0].yam_type,
        amount_kg: data[0].amount_kg,
        pricePerKg: data[0].price_per_kg,
        totalPrice: data[0].total_price,
        status: data[0].status,
        createdAt: new Date(data[0].created_at).toLocaleString()
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update order status
app.put('/admin/orders/:id/status', async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: status })
      .eq('id', orderId)
      .select();
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }
    
    res.json({ 
      success: true, 
      order: data[0] 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete order
app.delete('/admin/orders/:id', async (req, res) => {
  const orderId = parseInt(req.params.id);
  
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);
    
    if (error) throw error;
    
    res.json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Export the handler
exports.handler = serverless(app);
