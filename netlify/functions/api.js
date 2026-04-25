const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;

  // Helper to send response
  const sendResponse = (statusCode, body) => ({
    statusCode,
    headers,
    body: JSON.stringify(body)
  });

  // GET /admin/orders - Fetch all orders
  if (path === '/admin/orders' && method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) throw error;
      
      return sendResponse(200, { success: true, orders: data });
    } catch (error) {
      return sendResponse(500, { success: false, error: error.message });
    }
  }

  // GET /orders - Fetch orders for customer
  if (path === '/orders' && method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) throw error;
      
      return sendResponse(200, { success: true, total: data.length, orders: data });
    } catch (error) {
      return sendResponse(500, { success: false, error: error.message });
    }
  }

  // POST /order - Create new order
  if (path === '/order' && method === 'POST') {
    try {
      const { name, address, yamType, amount, price } = JSON.parse(event.body);

      // Validate
      if (!name || !address || !yamType || !amount || !price) {
        return sendResponse(400, { success: false, error: "All fields are required." });
      }

      const amountNum = parseFloat(amount);
      const priceNum = parseFloat(price);
      
      if (isNaN(amountNum) || amountNum <= 0 || isNaN(priceNum) || priceNum <= 0) {
        return sendResponse(400, { success: false, error: "Amount and price must be positive numbers." });
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

      const { data, error } = await supabase
        .from('orders')
        .insert([newOrder])
        .select();
      
      if (error) throw error;
      
      return sendResponse(201, {
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
      return sendResponse(500, { success: false, error: error.message });
    }
  }

  // PUT /admin/orders/:id/status - Update order status
  if (path.startsWith('/admin/orders/') && path.endsWith('/status') && method === 'PUT') {
    try {
      const parts = path.split('/');
      const orderId = parseInt(parts[3]);
      const { status } = JSON.parse(event.body);
      
      const { data, error } = await supabase
        .from('orders')
        .update({ status: status })
        .eq('id', orderId)
        .select();
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return sendResponse(404, { success: false, error: "Order not found." });
      }
      
      return sendResponse(200, { success: true, order: data[0] });
    } catch (error) {
      return sendResponse(500, { success: false, error: error.message });
    }
  }

  // DELETE /admin/orders/:id - Delete order
  if (path.startsWith('/admin/orders/') && method === 'DELETE') {
    try {
      const parts = path.split('/');
      const orderId = parseInt(parts[3]);
      
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      
      if (error) throw error;
      
      return sendResponse(200, { success: true, message: "Order deleted successfully" });
    } catch (error) {
      return sendResponse(500, { success: false, error: error.message });
    }
  }

  // 404 for unknown routes
  return sendResponse(404, { success: false, error: "Route not found" });
};
