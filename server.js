const express = require("express");
const bodyParser = require("body-parser");
const stripe = require("stripe")("sk_test_51Pik3n2NQwEappxdmwBNVnBfTIBjWJUod4ooC46Le2ZmhrZw5qOauZXmMKG4ry589IzNcEkZyunZWqC4qmEpYWFf000ixkAPLd");
const axios = require("axios");
const Airtable = require("airtable");
const app = express();

// Set up Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base('appOMn7frxGPNwEOz');

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set("view engine", "ejs");
app.use(express.static("public"));


// Route: Home Page (GET)
app.get("/", async (req, res) => {
    try {
        // Fetch the current active vertical(s) from the "Current Vertical" table
        const verticalRecords = await base('Current Vertical').select({
            maxRecords: 1
        }).firstPage();

        // Log the raw vertical records
        console.log("Raw Vertical Records:", verticalRecords);

        // Ensure that verticalRecords has data
        if (verticalRecords.length === 0 || !verticalRecords[0].fields['Vertical']) {
            console.log("No active verticals found.");
            return res.status(404).send("No active verticals found in Airtable.");
        }

        const activeVertical = verticalRecords[0].fields['Vertical'];

        // Log the active vertical
        console.log("Active Vertical:", activeVertical);

        // Fetch the configuration for the active vertical from the "Configuration Table"
        const configRecords = await base('Configuration Table').select({
            filterByFormula: `{Vertical} = '${activeVertical}'`
        }).firstPage();

        // Log the configuration records
        console.log("Configuration Records:", configRecords);

        if (configRecords.length > 0) {
            // Log the raw actionText data
            console.log("Raw actionText Data:", configRecords[0].fields['actionText']);

            // Safely parse the JSON, checking if the field is not empty or undefined
            const actionTextsField = configRecords[0].fields['actionText'];
            console.log("Action Texts Field:", actionTextsField);

            const actionTexts = actionTextsField ? JSON.parse(actionTextsField) : {};

            // Log parsed actionTexts to ensure it's an object
            console.log("Parsed actionTexts Object:", actionTexts);

            const headerText = actionTexts.headerText || "Default Header";
            const footerText = actionTexts.footerText || "Default Footer Text";
            const welcomeText = actionTexts.welcomeText || "Welcome to BRP Services";
            const instructionText = actionTexts.instructionText || "Select an option to get started:";
            const verifyText = actionTexts.verifyText || "Verify";
            const initiateOrderText = actionTexts.initiateOrderText || "Initiate Order";
            const generateLinkText = actionTexts.generateLinkText || "Generate Payment Link";

            // Render the index page with dynamic content
            res.render("index", {
                headerText,
                footerText,
                welcomeText,
                instructionText,
                verifyText,
                initiateOrderText,
                generateLinkText
            });
        } else {
            console.log("No configuration found for the selected vertical.");
            // Render with default texts if no matching record is found
            res.render("index", {
                headerText: "Default Header",
                footerText: "Default Footer Text",
                welcomeText: "Default Welcome Text",
                instructionText: "Default Instruction Text",
                verifyText: "Default Verify Text",
                initiateOrderText: "Default Initiate Order Text",
                generateLinkText: "Default Generate Link Text"
            });
        }
    } catch (error) {
        console.error("Error fetching configuration from Airtable:", error);
        res.status(500).send('Server Error');
    }
});

// Route: Verify Input Page (GET)
app.get("/verify", async (req, res) => {
    try {
        // Fetch the current active vertical(s) from the "Current Vertical" table
        const verticalRecords = await base('Current Vertical').select({}).firstPage();
        const activeVertical = verticalRecords[0].fields['Vertical'];

        // Fetch the configuration for the active vertical from the "Configuration Table"
        const configRecords = await base('Configuration Table').select({
            filterByFormula: `{Vertical} = '${activeVertical}'`
        }).firstPage();

        if (configRecords.length > 0) {
            // Safely parse the JSON
            const actionTextsField = configRecords[0].fields['actionText'];
            const actionTexts = actionTextsField ? JSON.parse(actionTextsField) : {};

            const verifyText = actionTexts.verifyText || "Verify";
            const headerText = actionTexts.headerText || "Default Header";
            const footerText = actionTexts.footerText || "Default Footer Text";
            const instructionText = actionTexts.instructionText || "Enter the details below:";

            // Render the generic verify page with dynamic content
            res.render("verify", {
                verifyText,
                headerText,
                footerText,
                instructionText,
                productLabel: actionTexts.productLabel || "Product ID",  // Dynamic labels
                serialLabel: actionTexts.serialLabel || "Serial Number"
            });
        } else {
            // Render a generic error message or fallback view
            res.status(404).send("Configuration not found for the selected vertical.");
        }
    } catch (error) {
        console.error("Error fetching configuration from Airtable:", error);
        res.status(500).send('Server Error');
    }
});

// Route: Handle Warranty Verification Submission (POST) and Render Current Status
app.post("/verify", async (req, res) => {
    const { productId, serialNumber } = req.body;

    // Fetch the current active vertical from the "Current Vertical" table
    const verticalRecords = await base('Current Vertical').select({}).firstPage();
    const activeVertical = verticalRecords[0].fields['Vertical'];

    // Fetch the configuration for the active vertical from the "Configuration Table"
    const configRecords = await base('Configuration Table').select({
        filterByFormula: `{Vertical} = '${activeVertical}'`
    }).firstPage();

    if (configRecords.length > 0) {
        // Safely parse the JSON fields
        const actionTextsField = configRecords[0].fields['actionText'];
        const actionTexts = actionTextsField ? JSON.parse(actionTextsField) : {};
        const productVerifiedField = configRecords[0].fields['ProductVerified'];
        const productVerified = productVerifiedField ? JSON.parse(productVerifiedField) : {};

        // Extract product information
        const productInfo = productVerified[productId] || {};

        // Check if the product exists and if the serial number matches
        if (productInfo.serialNumber === serialNumber) {
            res.render("current-status", {
                productInfo,
                headerText: actionTexts.headerText || "Current Status",
                footerText: actionTexts.footerText || "All rights reserved.",
                statusHeader: actionTexts.statusHeader || "Status Details",
                detailsTitle: actionTexts.detailsTitle || "Details",
                productLabel: actionTexts.productLabel || "Product Name",
                serialLabel: actionTexts.serialLabel || "Serial Number",
                statusLabel: actionTexts.statusLabel || "Status",
                amountLabel: actionTexts.amountLabel || "Total Amount",
                verticalName: activeVertical
            });
        } else {
            // If verification fails, render an error message
            res.status(404).send("Product ID or Serial Number not found.");
        }
    } else {
        // If no configuration is found for the vertical
        res.status(404).send("Configuration not found for the selected vertical.");
    }
});

// Route: Current Status Page (GET)
app.get("/current-status", async (req, res) => {
    try {
        // Fetch the current active vertical(s) from the "Current Vertical" table
        const verticalRecords = await base('Current Vertical').select({}).firstPage();
        const activeVertical = verticalRecords[0].fields['Vertical'];

        // Fetch the configuration for the active vertical from the "Configuration Table"
        const configRecords = await base('Configuration Table').select({
            filterByFormula: `{Vertical} = '${activeVertical}'`
        }).firstPage();

        if (configRecords.length > 0) {
            // Safely parse the JSON
            const currentStatusElementsField = configRecords[0].fields['currentStatusElements'];
            const currentStatusElements = currentStatusElementsField ? JSON.parse(currentStatusElementsField) : {};

            // Render the current-status page with dynamic content
            res.render("current-status", {
                title: currentStatusElements.title || "Current Status",
                elements: currentStatusElements.elements || []
            });
        } else {
            // Render a generic error message or fallback view
            res.status(404).send("Configuration not found for the selected vertical.");
        }
    } catch (error) {
        console.error("Error fetching configuration from Airtable:", error);
        res.status(500).send('Server Error');
    }
});

// Route: Render the Order Page (GET)
app.get("/order", (req, res) => {
  res.render("order");
});

// Route: Handle Order Submission (POST)
app.post("/order", async (req, res) => {
  const { firstName, lastName, product, productId, serialNumber } = req.body;

  // Calculate the new expiration date based on the selected package
  const currentDate = new Date();
  let yearsToAdd = 0;

  if (product === "1-Year Warranty Extension") {
    yearsToAdd = 1;
  } else if (product === "2-Year Warranty Extension") {
    yearsToAdd = 2;
  } else if (product === "3-Year Warranty Extension") {
    yearsToAdd = 3;
  }

  const expirationDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + yearsToAdd));

  const warrantyExtension = {
    warrantyNumber: "BRP-WARRANTY-2024",
    package: product,
    totalPrice: "1499$",
    firstName,
    lastName,
    productId,
    serialNumber,
    expirationDate: expirationDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
  };

  // Create a payment session with Stripe
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Warranty Extension: ${product}`,
            },
            unit_amount: 149900, // price in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/success`,
      cancel_url: `${req.headers.origin}/cancel`,
    });

    // Send the payment link to the webhook (this part is optional)
    const webhookUrl = "https://hooks.us.webexconnect.io/events/QCVQY3V48T";
    const message = `Thank you for trusting Tarek Manufacturing Services. We have generated a secure payment link for you: ${session.url}`;

    await axios.post(webhookUrl, {
      text: message,
    });

    // Render confirmation page with the payment link
    res.render("confirm", { warrantyExtension, paymentLink: session.url });
  } catch (error) {
    console.error("Error creating payment link:", error);
    res.status(500).send(`Error creating payment link: ${error.message}`);
  }
});

// Route: Payment Success
app.get("/success", (req, res) => {
  res.send("Payment successful!");
});

// Route: Payment Cancel
app.get("/cancel", (req, res) => {
  res.send("Payment canceled.");
});

// Route: Verify Payment (GET)
app.get("/verify-payment", async (req, res) => {
  try {
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 1,
    });

    if (paymentIntents.data.length === 0) {
      return res.status(404).send("No transactions found.");
    }

    const latestPayment = paymentIntents.data[0];
    const charges = await stripe.charges.list({
      payment_intent: latestPayment.id,
      limit: 1,
    });

    if (charges.data.length === 0) {
      return res.status(404).send("No charges found for the latest transaction.");
    }

    const latestCharge = charges.data[0];

    const transaction = {
      id: latestPayment.id,
      customer: latestCharge.billing_details.name || 'Tarek Ayadi',
      status: latestPayment.status,
      amount: latestPayment.amount_received / 100,
      paidDate: new Date(latestPayment.created * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }),
    };

    // Add warranty details to the transaction
    transaction.warrantyExtension = {
      warrantyNumber: "BRP-WARRANTY-2024",
      package: "1-Year Warranty Extension", // Adjust as necessary based on the product selected
      expirationDate: "2026-08-12" // This should reflect the actual calculated expiration date
    };

    // Send the latest transaction details, including warranty info, to the webhook
    await axios.post("https://hooks.us.webexconnect.io/events/381TJKDP3D", {
      transaction
    });

    // Render the verify-payment view with the transaction details
    res.render("verify-payment", { transactions: [transaction] });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).send(`Error fetching transactions: ${error.message}`);
  }
});

// Route: Verify Warranty Input Page (GET)
app.get("/verify-warranty", (req, res) => {
  res.render("verify-warranty");
});

// Route: Handle Warranty Verification Submission (POST)
app.post("/verify-warranty", (req, res) => {
  const { productId, serialNumber } = req.body;

  const productDetails = {
    "SKI-DOO-MXZ-XRS-850": {
      productName: "Ski-Doo MXZ X-RS 850 E-TEC",
      serialNumber: "SN123456789",
      purchaseDate: "2021-08-15",
      originalWarrantyPeriod: "2 years",
      originalExpirationDate: "2023-08-15",
    },
  };

  let warrantyStatus = "expired";  // Default to expired for demonstration

  // Check if the product exists and if the serial number matches
  if (productDetails[productId] && productDetails[productId].serialNumber === serialNumber) {
    const productInfo = productDetails[productId];
    res.render("verify-warranty-result", { productInfo, warrantyStatus });
  } else {
    console.error("Product ID or Serial Number not found.");
    res.status(404).send("Product ID or Serial Number not found.");
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});