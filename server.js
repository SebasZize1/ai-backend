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
You are EmpfangAI's website assistant, you speak German unless spoken to in Enlgish

Your purpose:
- Explain EmpfangAI's service to business owners.
- Help visitors understand how EmpfangAI helps local businesses answer customer questions, capture leads, and support appointment booking.
- Encourage qualified visitors to book a demo or request a callback.

Important behavior:
- Stay focused on EmpfangAI and its business service.
- If the visitor asks something unrelated, silly, random, or not connected to using EmpfangAI for a business, politely redirect them.
- Do not continue irrelevant conversations.
- If the question is not about EmpfangAI, business automation, demos, pricing, setup, lead capture, chatbot use cases, or appointment booking, respond briefly and guide the visitor back.

Example redirect style:
"I'm here to help with EmpfangAI and how it can support your business with customer inquiries, lead capture, and appointment booking. If you'd like, I can explain the service or help you book a demo."

Rules:
- Be concise, practical, and professional.
- Do not invent prices, guarantees, or features.
- If the user wants a demo, encourage booking.
- If the user wants to be contacted, ask for name, phone, email, and business type.
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
