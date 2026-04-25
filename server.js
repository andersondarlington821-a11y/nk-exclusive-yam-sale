// ============================================================
// server.js — Yam Order Backend (Node.js + Express)
//
// HOW TO RUN:
//   1. Make sure Node.js is installed (https://nodejs.org)
//   2. Open your terminal in this folder
//   3. Run:  npm install express cors
//   4. Run:  node server.js
//   5. Server starts at http://localhost:3000
// ============================================================


// ============================================================
// STEP 1: IMPORT PACKAGES
//
// 'require' is how Node.js loads packages (like 'import' in Python).
// - express  : the framework that handles routes and HTTP requests
// - cors     : allows your HTML file to talk to this server
// - fs       : built-in Node module to read/write files (no install needed)
// - path     : built-in Node module to handle file paths
// ============================================================
const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');


// ============================================================
// STEP 2: CREATE THE APP
//
// express() creates the server application.
// Think of 'app' as the main object we use to define all routes.
// ============================================================
const app = express();


// ============================================================
// STEP 3: MIDDLEWARE (things that run on EVERY request)
//
// Middleware is code that runs between receiving a request
// and sending a response. We need two pieces here:
//
// 1. cors()         — lets your HTML page (on any origin) talk to
//                     this server without browser security errors
// 2. express.json() — automatically reads the JSON body of incoming
//                     requests and makes it available as req.body
// ============================================================
app.use(cors());
app.use(express.json());


// ============================================================
// STEP 4: FILE-BASED DATABASE SETUP
//
// We save orders to a local JSON file called orders.json.
// This means orders survive even if you restart the server.
//
// The file will be created automatically if it doesn't exist yet.
// ============================================================
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// --- Helper: Read all orders from the file ---
function loadOrders() {
  // Check if the file exists yet
  if (!fs.existsSync(ORDERS_FILE)) {
    return [];  // No file yet = no orders, return empty array
  }
  // Read the file content as a string, then parse it into a JS array
  const fileContent = fs.readFileSync(ORDERS_FILE, 'utf8');
  return JSON.parse(fileContent);
}

// --- Helper: Write orders array back to the file ---
function saveOrders(orders) {
  // JSON.stringify converts the JS array back into a JSON string.
  // The 'null, 2' part makes it nicely formatted (indented by 2 spaces).
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}


// ============================================================
// STEP 5: PRICING CONFIG
//
// Price per kilogram for each yam type in Naira.
// ============================================================

// ============================================================
// STEP 6: ROUTES
//
// A "route" tells the server what to do when it receives a
// request at a specific URL with a specific HTTP method.
//
// Format:  app.METHOD('/url', function(req, res) { ... })
//   - req  = the incoming REQUEST (contains headers, body, params)
//   - res  = the RESPONSE object (used to send data back)
// ============================================================


// ------------------------------------------------------------
// ROUTE 1: GET /
// Just a health-check route — visit http://localhost:3000
// in your browser to confirm the server is running.
// ------------------------------------------------------------
app.get('/', function(req, res) {
  res.json({ message: "🍠 Yam Order API is running!" });
});


// ------------------------------------------------------------
// ROUTE 2: POST /order
// Called when a customer submits the order form.
//
// Expects a JSON body like:
// {
//   "name":    "Ada Obi",
//   "address": "12 Lagos Road",
//   "yamType": "White Yam",
//   "amount":  5
// }
// ------------------------------------------------------------
app.post('/order', function(req, res) {

  // req.body contains the JSON data sent from the HTML form
  const { name, address, yamType, amount } = req.body;

  // --- Validate: make sure all fields were provided ---
  if (!name || !address || !yamType || !amount) {
    // 400 means "Bad Request" — the client sent incomplete data
    return res.status(400).json({
      success: false,
      error: "All fields (name, address, yamType, amount) are required."
    });
  }


  // --- Validate: amount must be a positive number ---
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({
      success: false,
      error: "Amount must be a positive number."
    });
  }

 // Read the price the user typed in
const pricePerKg = parseFloat(req.body.price);

// Validate it is a real positive number
if (isNaN(pricePerKg) || pricePerKg <= 0) {
  return res.status(400).json({
    success: false,
    error: "Price must be a positive number."
  });
}

// Calculate total using the user's price
const totalPrice = pricePerKg * amountNum;

  // --- Build the new order object ---
  const orders  = loadOrders();
  const orderId = orders.length + 1;  // Simple incrementing ID

  const newOrder = {
    id:         orderId,
    name:       name.trim(),
    address:    address.trim(),
    yamType:    yamType,
    amount_kg:  amountNum,
    pricePerKg: pricePerKg,
    totalPrice: totalPrice,
    status:     "Pending",
    createdAt:  new Date().toLocaleString(),  // current date & time
    notified:   false  // Track if admin has been notified
  };

  // --- Save the new order to the file ---
  orders.push(newOrder);   // add it to the array
  saveOrders(orders);      // write the updated array to disk

  // --- Send a success response back to the browser ---
  // 201 means "Created" — standard status for successful POST
  res.status(201).json({
    success: true,
    message: "Order placed successfully!",
    order:   newOrder
  });
});


// ------------------------------------------------------------
// ROUTE 3: GET /orders
// Returns ALL orders — used by your admin dashboard.
// ------------------------------------------------------------
app.get('/orders', function(req, res) {
  const orders = loadOrders();
  res.json({
    success: true,
    total:   orders.length,
    orders:  orders
  });
});


// ------------------------------------------------------------
// ROUTE 4: GET /admin/orders
// Returns ALL orders for admin dashboard (same as /orders but dedicated endpoint)
// ------------------------------------------------------------
app.get('/admin/orders', function(req, res) {
  const orders = loadOrders();
  res.json({
    success: true,
    orders:  orders
  });
});


// ------------------------------------------------------------
// ROUTE 5: GET /order/:id
// Returns ONE specific order by its ID.
//
// The ':id' part is a URL parameter — it matches anything.
// e.g. GET /order/3  → req.params.id will be "3"
// ------------------------------------------------------------
app.get('/order/:id', function(req, res) {

  // req.params.id is a string, so convert it to a number
  const orderId = parseInt(req.params.id);

  const orders = loadOrders();

  // .find() searches the array and returns the first match
  const order = orders.find(function(o) {
    return o.id === orderId;
  });

  // If no order was found, send a 404 (Not Found) response
  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }

  res.json({ success: true, order: order });
});


// ------------------------------------------------------------
// ROUTE 6: PATCH /order/:id/status
// Updates just the status of one order.
//
// PATCH means "partially update" (vs PUT which replaces everything).
// Expects body: { "status": "Delivered" }
// ------------------------------------------------------------
app.patch('/order/:id/status', function(req, res) {

  const orderId   = parseInt(req.params.id);
  const newStatus = req.body.status;

  // Only these status values are allowed
  const allowedStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

  if (!allowedStatuses.includes(newStatus)) {
    return res.status(400).json({
      success: false,
      error: `Status must be one of: ${allowedStatuses.join(', ')}`
    });
  }

  const orders = loadOrders();

  // Find the index of the order we want to update
  const index = orders.findIndex(function(o) {
    return o.id === orderId;
  });

  // -1 means the order wasn't found
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }

  // Update the status field on that specific order
  orders[index].status = newStatus;
  saveOrders(orders);  // save the change back to the file

  res.json({
    success: true,
    message: `Order #${orderId} status updated to "${newStatus}".`,
    order:   orders[index]
  });
});


// ------------------------------------------------------------
// ROUTE 7: PUT /admin/orders/:id/status
// Update order status (for admin dashboard)
// ------------------------------------------------------------
app.put('/admin/orders/:id/status', function(req, res) {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;
  
  const orders = loadOrders();
  const orderIndex = orders.findIndex(o => o.id === orderId);
  
  if (orderIndex === -1) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }
  
  orders[orderIndex].status = status;
  saveOrders(orders);
  
  res.json({ 
    success: true, 
    order: orders[orderIndex] 
  });
});


// ------------------------------------------------------------
// ROUTE 8: DELETE /admin/orders/:id
// Delete an order (for admin dashboard)
// ------------------------------------------------------------
app.delete('/admin/orders/:id', function(req, res) {
  const orderId = parseInt(req.params.id);
  
  let orders = loadOrders();
  const initialLength = orders.length;
  orders = orders.filter(o => o.id !== orderId);
  
  if (orders.length === initialLength) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }
  
  saveOrders(orders);
  res.json({ success: true, message: "Order deleted successfully" });
});


// ------------------------------------------------------------
// ROUTE 9: POST /admin/notifications/mark-sent
// Mark orders as notified
// ------------------------------------------------------------
app.post('/admin/notifications/mark-sent', function(req, res) {
  const { orderIds } = req.body;
  
  const orders = loadOrders();
  orders.forEach(order => {
    if (orderIds.includes(order.id)) {
      order.notified = true;
    }
  });
  
  saveOrders(orders);
  res.json({ success: true });
});


// ------------------------------------------------------------
// ROUTE 10: Serve admin dashboard HTML file
// ------------------------------------------------------------
app.get('/admin', function(req, res) {
  res.sendFile(path.join(__dirname, 'admin.html'));
});


// ============================================================
// STEP 7: START THE SERVER
//
// app.listen() starts the server on a port number.
// Port 3000 is the standard for Node.js development servers.
// Once running, visit http://localhost:3000 in your browser.
// ============================================================
const PORT = 3000;

app.listen(PORT, function() {
  console.log('========================================');
  console.log(`🍠 Yam Order Server is running!`);
  console.log(`📡 Customer page: http://localhost:${PORT}`);
  console.log(`👑 Admin dashboard: http://localhost:${PORT}/admin`);
  console.log('========================================');
});