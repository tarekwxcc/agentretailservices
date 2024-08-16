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

// Route: Handle Verify (POST) and Render Current Status
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
app.get("/order", async (req, res) => {
    try {
        // Fetch the current active vertical(s) from the "Current Vertical" table
        const verticalRecords = await base('Current Vertical').select({}).firstPage();
        const activeVertical = verticalRecords[0].fields['Vertical'];

        // Fetch the configuration for the active vertical from the "Configuration Table"
        const configRecords = await base('Configuration Table').select({
            filterByFormula: `{Vertical} = '${activeVertical}'`
        }).firstPage();

        if (configRecords.length > 0) {
            // Safely parse the JSON fields
            const orderPageElementsField = configRecords[0].fields['orderPageElements'];
            const orderPageElements = orderPageElementsField ? JSON.parse(orderPageElementsField) : {};

            // Safely parse the product list (assuming it's in the same table)
            const productsField = configRecords[0].fields['ProductVerified'];
            const productsData = productsField ? JSON.parse(productsField) : {};

            // Convert the productsData into a format suitable for the dropdown
            const products = Object.keys(productsData).map(productId => ({
                id: productId,
                name: productsData[productId].productName
            }));

            // Render the order page with dynamic content and the list of products
            res.render("order", {
                pageTitle: orderPageElements.pageTitle || "Order Your Product",
                headerText: orderPageElements.headerText || "Retail Services - Order Your Product",
                instructionText: orderPageElements.instructionText || "Please fill out the details below to initiate your order.",
                firstNameLabel: orderPageElements.firstNameLabel || "First Name",
                lastNameLabel: orderPageElements.lastNameLabel || "Last Name",
                productLabel: orderPageElements.productLabel || "Product",
                products, // Pass the products list to the view
                submitButtonText: orderPageElements.submitButtonText || "Submit Order"
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

// Route: Handle Order Submission (POST)
app.post("/order", async (req, res) => {
  const { firstName, lastName, product } = req.body; // Here `product` is the selected Product ID.

  try {
    // Fetch the current active vertical
    const verticalRecords = await base('Current Vertical').select({}).firstPage();
    const activeVertical = verticalRecords[0].fields['Vertical'];

    // Fetch the ProductVerified data for the active vertical
    const configRecords = await base('Configuration Table').select({
      filterByFormula: `{Vertical} = '${activeVertical}'`
    }).firstPage();

    if (configRecords.length > 0) {
      const productVerifiedField = configRecords[0].fields['ProductVerified'];
      const productVerified = productVerifiedField ? JSON.parse(productVerifiedField) : {};

      // Fetch the details of the selected product using its ID
      const productDetails = productVerified[product];

      if (!productDetails) {
        throw new Error("Product details are missing or incomplete.");
      }

      // Create the payment link using the product details
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productDetails.productName,
              },
              unit_amount: parseInt(productDetails.totalAmount.replace('$', '')) * 100, // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${req.headers.origin}/success`,
        cancel_url: `${req.headers.origin}/cancel`,
      });

      // Prepare the orderDetails to be passed to the template
      const orderDetails = {
        productName: productDetails.productName,
        orderId: product, // Assuming the product ID is the order ID
        totalPrice: productDetails.totalAmount
      };

      // Send the payment link to the webhook (optional)
      const webhookUrl = "https://hooks.us.webexconnect.io/events/QCVQY3V48T";
      const message = `Thank you for your order. We have generated a secure payment link for you: ${session.url}`;

      await axios.post(webhookUrl, {
        text: message,
      });

      // Render the confirmation page with the payment link and order details
      res.render("confirm", {
        firstName,
        lastName,
        orderDetails,
        paymentLink: session.url,
        footerText: "Thank you for your order!"
      });
    } else {
      res.status(404).send("Configuration not found for the selected vertical.");
    }
  } catch (error) {
    console.error("Error processing order:", error);
    res.status500().send(`Error processing order: ${error.message}`);
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
        // Fetch the current active vertical
        const verticalRecords = await base('Current Vertical').select({}).firstPage();
        const activeVertical = verticalRecords[0].fields['Vertical'];

        // Fetch the configuration for the active vertical from the "Configuration Table"
        const configRecords = await base('Configuration Table').select({
            filterByFormula: `{Vertical} = '${activeVertical}'`
        }).firstPage();

        if (configRecords.length > 0) {
            // Safely parse the JSON for actionText
            const actionTextsField = configRecords[0].fields['actionText'];
            const actionTexts = actionTextsField ? JSON.parse(actionTextsField) : {};

            const headerText = actionTexts.headerText || "Verify Payment";
            const footerText = actionTexts.footerText || "&copy; 2024 Tarek Services. All rights reserved.";

            // Fetch transaction details (this part remains unchanged)
            const paymentIntents = await stripe.paymentIntents.list({ limit: 1 });

            if (paymentIntents.data.length === 0) {
                return res.status(404).send("No transactions found.");
            }

            const latestPayment = paymentIntents.data[0];
            const charges = await stripe.charges.list({ payment_intent: latestPayment.id, limit: 1 });

            if (charges.data.length === 0) {
                return res.status(404).send("No charges found for the latest transaction.");
            }

            const latestCharge = charges.data[0];

            const transaction = {
                id: latestPayment.id,
                customer: latestCharge.billing_details.name || 'Anonymous Customer',
                status: latestPayment.status,
                amount: (latestPayment.amount_received / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                paidDate: new Date(latestPayment.created * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }),
            };

            // Render the verify-payment view with dynamic content
            res.render("verify-payment", {
                headerText,
                footerText,
                transactions: [transaction]
            });
        } else {
            res.status(404).send("Configuration not found for the selected vertical.");
        }
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).send(`Error fetching transactions: ${error.message}`);
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});