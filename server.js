require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PORT = process.env.PORT || 3000;

function detectLeadIntent(message) {
  const text = (message || "").toLowerCase();

  const leadKeywords = [
    "appointment",
    "book",
    "booking",
    "schedule",
    "demo",
    "consultation",
    "call me",
    "contact me",
    "price",
    "pricing",
    "interested",
    "speak to someone",
    "meeting"
  ];

  return leadKeywords.some((word) => text.includes(word));
}

async function sendLeadToMake(leadData) {
  if (!process.env.MAKE_WEBHOOK_URL) {
    console.log("MAKE_WEBHOOK_URL is missing");
    return;
  }

  try {
    console.log("Sending lead to Make:", leadData);

    const makeResponse = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(leadData),
    });

    const responseText = await makeResponse.text();

    console.log("Make status:", makeResponse.status);
    console.log("Make response:", responseText);
  } catch (error) {
    console.error("Error sending lead to Make:", error.message);
  }
}

app.get("/", (req, res) => {
  res.json({ status: "Backend is running" });
});

app.post("/chat", async (req, res) => {
  try {
    const {
      message,
      name,
      email,
      phone,
      date,
      business,
      industry,
      interested_service,
      callback_requested,
      booking_link_sent,
      notes,
      source
    } = req.body;

    console.log("Incoming req.body:", req.body);

    if (!message) {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    const isLead = detectLeadIntent(message);
    console.log("Lead detected:", isLead);

    const instructions = `
You are a helpful AI assistant for a local business.
Answer clearly, briefly, and professionally.

Rules:
- If the user asks about booking, appointments, demos, pricing, or being contacted, encourage the next step.
- If the user is ready to book, tell them they can leave their contact details or use this booking link:
  https://example.com/booking
- Keep answers short and practical.
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      instructions,
      input: message,
    });

    const reply =
      response.output_text ||
      "Thank you for your message. We will get back to you soon.";

    if (isLead) {
      const leadData = {
        date: date || new Date().toISOString().split("T")[0],
        name: name || "",
        phone: phone || "",
        email: email || "",
        business: business || "",
        industry: industry || "",
        message: message || "",
        interested_service: interested_service || "AI Assistant Demo",
        callback_requested: callback_requested || "No",
        booking_link_sent: booking_link_sent || "No",
        notes: notes || "",
        source: source || "Website"
      };

      await sendLeadToMake(leadData);
    }

    return res.json({
      reply,
      leadDetected: isLead,
    });
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Something went wrong on the server.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});