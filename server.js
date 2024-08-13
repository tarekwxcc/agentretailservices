const express = require("express");
const bodyParser = require("body-parser");
const stripe = require("stripe")(
  "sk_test_51Pik3n2NQwEappxdmwBNVnBfTIBjWJUod4ooC46Le2ZmhrZw5qOauZXmMKG4ry589IzNcEkZyunZWqC4qmEpYWFf000ixkAPLd"
);
const axios = require("axios");
const app = express();

// Use body-parser's raw middleware for the /webhook endpoint
app.post("/webhook", bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, 'whsec_myQuSGH3AxXD5QrM9obohmYMtxzbQaAe'); // Replace 'whsec_myQuSGH3AxXD5QrM9obohmYMtxzbQaAe' with your actual webhook secret
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;

    // Fetch the charge associated with the payment intent
    const charges = await stripe.charges.list({
      payment_intent: paymentIntent.id,
      limit: 1, // Fetch only the latest charge
    });

    if (charges.data.length > 0) {
      const latestCharge = charges.data[0];

      const transaction = {
        id: paymentIntent.id,
        customer: latestCharge.billing_details.name || 'Tarek Ayadi', // Hardcoded to "Tarek Ayadi"
        status: paymentIntent.status,
        amount: paymentIntent.amount_received / 100, // Convert amount to dollars
        paidDate: new Date(paymentIntent.created * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }) // Convert Unix timestamp to EST time
      };

      // Send the latest transaction details to the webhook
      await axios.post("https://hooks.us.webexconnect.io/events/381TJKDP3D", {
        transaction
      });
    }
  }

  res.status(200).send('Received');
});

// Use body-parser's json and urlencoded middleware for other routes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index");
});

// Update the route to handle '/order' instead of '/book'
app.post("/order", (req, res) => {
  const { firstName, lastName, product } = req.body;

  // Calculate ETA, which is 48 hours from the current time
  const currentDate = new Date();
  const etaDate = new Date(currentDate.getTime() + 48 * 60 * 60 * 1000); // Add 48 hours

  const reservation = {
    reservationNumber: "1305TO52",
    product: product, // This now represents the product selected
    totalPrice: "1000$", // You can update this as needed
    firstName,
    lastName,
    eta: etaDate.toLocaleString('en-US', { timeZone: 'America/New_York' }) // Format ETA in EST
  };
  res.render("confirm", { reservation });
});

app.post("/confirm", async (req, res) => {
  const { reservation } = req.body;
  const { firstName, lastName } = reservation;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1Plzy92NQwEappxda5FmQ63a', // Replace with your actual price ID
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/success`,
      cancel_url: `${req.headers.origin}/cancel`,
      customer_email: req.body.email, // Assuming email is provided in the request
      client_reference_id: reservation.reservationNumber, // Optional: associate the session with the reservation
      metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    // Send the payment link to the webhook
    const webhookUrl = "https://hooks.us.webexconnect.io/events/QCVQY3V48T";
    const message = `Thank you for trusting RetailExpert Services. We have generated a secure payment link for you: ${session.url}`;

    await axios.post(webhookUrl, {
      text: message,
    });

    res.send(
      `Order confirmed. Please complete the payment using the following link: <a href="${session.url}">Pay Now</a>`
    );
  } catch (error) {
    console.error("Error creating payment link:", error);
    res.status(500).send(`Error creating payment link: ${error.message}`);
  }
});

app.get("/success", (req, res) => {
  res.send("Payment successful!");
});

app.get("/cancel", (req, res) => {
  res.send("Payment canceled.");
});

// Updated endpoint to fetch the latest transaction
app.get("/verify-payment", async (req, res) => {
  try {
    // Fetch the latest payment intent
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 1, // Fetch only the latest payment intent
    });

    if (paymentIntents.data.length === 0) {
      return res.status(404).send("No transactions found.");
    }

    const latestPayment = paymentIntents.data[0];

    // Fetch the charge associated with the latest payment intent
    const charges = await stripe.charges.list({
      payment_intent: latestPayment.id,
      limit: 1, // Fetch only the latest charge
    });

    if (charges.data.length === 0) {
      return res.status(404).send("No charges found for the latest transaction.");
    }

    const latestCharge = charges.data[0];

    const transaction = {
      id: latestPayment.id,
      customer: latestCharge.billing_details.name || 'Tarek Ayadi', // Hardcoded to "Tarek Ayadi"
      status: latestPayment.status,
      amount: latestPayment.amount_received / 100, // Convert amount to dollars
      paidDate: new Date(latestPayment.created * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }) // Convert Unix timestamp to EST time
    };

    res.render("verify-payment", { transactions: [transaction] });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).send(`Error fetching transactions: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});