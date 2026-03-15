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
const BOOKING_LINK =
  process.env.BOOKING_LINK || "https://calendly.com/your-real-link/demo";

/**
 * -----------------------------
 * HELPERS
 * -----------------------------
 */

function normalizeText(text) {
  return (text || "").toLowerCase().trim();
}

function containsAny(text, keywords) {
  return keywords.some((word) => text.includes(word));
}

function extractContactInfo(rawText = "") {
  const text = String(rawText);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(\+?\d[\d\s()/.-]{6,}\d)/);
  const fullNameMatch = text.match(
    /\b([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)\b/
  );

  return {
    extractedEmail: emailMatch ? emailMatch[0] : "",
    extractedPhone: phoneMatch ? phoneMatch[0] : "",
    extractedName: fullNameMatch
      ? `${fullNameMatch[1]} ${fullNameMatch[2]}`
      : "",
  };
}

/**
 * -----------------------------
 * RELEVANCE / INTENTS
 * -----------------------------
 */

function isRelevantToEmpfangAI(message) {
  const text = normalizeText(message);

  const relevantKeywords = [
    "empfangai",
    "ki",
    "ai",
    "chatbot",
    "assistent",
    "kundenanfragen",
    "lead",
    "leads",
    "termin",
    "termine",
    "terminbuchung",
    "buchung",
    "demo",
    "meeting",
    "beratung",
    "automatisierung",
    "automation",
    "website",
    "unternehmen",
    "firma",
    "praxis",
    "zahnarzt",
    "zahnarztpraxis",
    "hausarzt",
    "kanzlei",
    "werkstatt",
    "makler",
    "anfragen",
    "kontakt",
    "rückruf",
    "callback",
    "preis",
    "preise",
    "kosten",
    "kostet",
    "service",
    "funktioniert",
    "einrichtung",
    "einsatzmöglichkeiten",
  ];

  return containsAny(text, relevantKeywords);
}

function detectLeadIntent(message) {
  const text = normalizeText(message);

  const leadKeywords = [
    "demo",
    "demo buchen",
    "ich möchte eine demo",
    "termin",
    "termin buchen",
    "terminbuchung",
    "buchen",
    "buchung",
    "meeting",
    "beratung",
    "interessiert",
    "ich interessiere mich",
    "interesse",
    "kontakt",
    "in kontakt",
    "kontaktieren",
    "bitte kontaktieren",
    "rückruf",
    "callback",
    "kosten",
    "kostet",
    "preis",
    "preise",
    "angebot",
    "für meine firma",
    "für mein unternehmen",
    "für meine praxis",
    "für meine zahnarztpraxis",
    "für meine kanzlei",
    "für meine werkstatt",
    "zahnarzt",
    "zahnarztpraxis",
    "hausarzt",
    "kanzlei",
    "werkstatt",
    "makler",
  ];

  return containsAny(text, leadKeywords);
}

function detectCallbackIntent(message) {
  const text = normalizeText(message);

  const callbackKeywords = [
    "ruf mich an",
    "rufen sie mich an",
    "bitte anrufen",
    "rückruf",
    "callback",
    "bitte kontaktieren",
    "kontaktieren sie mich",
    "ich möchte kontaktiert werden",
    "ich möchte mit jemandem sprechen",
    "in kontakt treten",
    "in kontakt",
    "contact me",
    "call me",
  ];

  return containsAny(text, callbackKeywords);
}

function detectBookingIntent(message) {
  const text = normalizeText(message);

  const bookingKeywords = [
    "demo",
    "demo buchen",
    "ich möchte eine demo",
    "termin",
    "termin buchen",
    "terminbuchung",
    "meeting",
    "beratung",
    "appointment",
    "schedule",
    "buchen",
    "buchung",
  ];

  return containsAny(text, bookingKeywords);
}

/**
 * -----------------------------
 * MAKE WEBHOOK
 * -----------------------------
 */

async function sendLeadToMake(data) {
  if (!process.env.MAKE_WEBHOOK_URL) {
    console.log("MAKE_WEBHOOK_URL fehlt");
    return {
      success: false,
      message: "MAKE_WEBHOOK_URL fehlt",
    };
  }

  try {
    console.log("Sending lead to Make:", data);

    const makeResponse = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const responseText = await makeResponse.text();

    console.log("Make status:", makeResponse.status);
    console.log("Make response:", responseText);

    return {
      success: makeResponse.ok,
      status: makeResponse.status,
      responseText,
    };
  } catch (error) {
    console.error("Fehler beim Senden an Make:", error.message);

    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * -----------------------------
 * TOOL ACTIONS
 * -----------------------------
 */

async function saveLead({
  name = "",
  phone = "",
  email = "",
  business = "",
  industry = "",
  message = "",
  interested_service = "EmpfangAI Demo",
  notes = "",
  source = "Website",
  booking_link_sent = "No",
}) {
  const leadData = {
    date: new Date().toISOString().split("T")[0],
    name,
    phone,
    email,
    business,
    industry,
    message,
    interested_service,
    callback_requested: "No",
    booking_link_sent,
    notes,
    source,
  };

  const result = await sendLeadToMake(leadData);

  return {
    success: result.success,
    type: "lead",
    leadData,
  };
}

function sendBookingLink() {
  return {
    success: true,
    type: "booking",
    bookingLink: BOOKING_LINK,
    message: "Hier können Sie direkt eine Demo buchen.",
  };
}

async function requestCallback({
  name = "",
  phone = "",
  email = "",
  business = "",
  industry = "",
  message = "",
  notes = "",
  source = "Website",
}) {
  const callbackData = {
    date: new Date().toISOString().split("T")[0],
    name,
    phone,
    email,
    business,
    industry,
    message,
    interested_service: "Rückruf-Anfrage",
    callback_requested: "Yes",
    booking_link_sent: "No",
    notes,
    source,
  };

  const result = await sendLeadToMake(callbackData);

  return {
    success: result.success,
    type: "callback",
    callbackData,
  };
}

/**
 * -----------------------------
 * ROUTES
 * -----------------------------
 */

app.get("/", (req, res) => {
  res.json({
    status: "Backend läuft",
    bookingLinkConfigured: !!process.env.BOOKING_LINK,
    makeWebhookConfigured: !!process.env.MAKE_WEBHOOK_URL,
  });
});

app.post("/chat", async (req, res) => {
  try {
    const {
      message,
      name = "",
      email = "",
      phone = "",
      business = "",
      industry = "",
      interested_service = "",
      notes = "",
      source = "Website",
    } = req.body;

    console.log("Incoming req.body:", req.body);

    if (!message) {
      return res.status(400).json({
        error: "Nachricht ist erforderlich.",
      });
    }

    const extracted = extractContactInfo(message);
    const hasContactInfo =
      !!extracted.extractedEmail || !!extracted.extractedPhone;

    const isLead = detectLeadIntent(message);
    const wantsCallback = detectCallbackIntent(message);
    const wantsBooking = detectBookingIntent(message);
    const keywordRelevant = isRelevantToEmpfangAI(message);

    const relevant =
      keywordRelevant || hasContactInfo || isLead || wantsCallback || wantsBooking;

    const shouldSaveAsLead = isLead || hasContactInfo;

    const finalName =
      name && name !== "Website Visitor" ? name : extracted.extractedName || "";
    const finalEmail = email || extracted.extractedEmail || "";
    const finalPhone = phone || extracted.extractedPhone || "";

    console.log("Keyword relevant:", keywordRelevant);
    console.log("Has contact info:", hasContactInfo);
    console.log("Relevant:", relevant);
    console.log("Lead detected:", isLead);
    console.log("Should save as lead:", shouldSaveAsLead);
    console.log("Callback detected:", wantsCallback);
    console.log("Booking detected:", wantsBooking);

    if (!relevant) {
      return res.json({
        reply:
          "Ich beantworte Fragen zu EmpfangAI. Fragen Sie mich z. B. nach Demo, Kosten, Ablauf oder Einsatzmöglichkeiten.",
        leadDetected: false,
        callbackRequested: false,
        bookingRequested: false,
        bookingLink: null,
        savedLead: false,
        savedCallback: false,
      });
    }

    const instructions = `
Du bist der Website-Assistent von EmpfangAI.

Zweck:
- Erkläre kurz, was EmpfangAI für Unternehmen macht.
- EmpfangAI hilft lokalen Unternehmen, Kundenanfragen zu beantworten, Leads zu erfassen und Terminbuchungen zu unterstützen.
- Führe interessierte Besucher zu Demo oder Rückruf.

Wichtige Regeln:
- Antworte immer auf Deutsch.
- Antworte kurz. Meist 1 bis 3 Sätze.
- Nur bei echter Nachfrage etwas ausführlicher.
- Bleibe bei EmpfangAI und geschäftlichen Fragen.
- Bei irrelevanten Fragen höflich zurücklenken.
- Keine erfundenen Preise, Garantien oder Features.
- Wenn jemand Interesse zeigt, frage bei Bedarf nach Name, Unternehmen und Kontakt.
- Wenn jemand eine Demo möchte, verweise auf die Buchung.
- Wenn jemand kontaktiert werden möchte, bitte um Telefonnummer oder E-Mail.

Stil:
- professionell
- freundlich
- knapp
- klar
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      instructions,
      input: message,
    });

    let reply =
      response.output_text ||
      "Gerne. Ich helfe Ihnen bei Fragen zu EmpfangAI.";

    let savedLead = null;
    let callbackResult = null;
    let bookingData = null;

    if (wantsCallback) {
      callbackResult = await requestCallback({
        name: finalName,
        phone: finalPhone,
        email: finalEmail,
        business,
        industry,
        message,
        notes,
        source,
      });

      reply = "Gerne. Senden Sie mir bitte Ihre Telefonnummer oder E-Mail-Adresse für den Rückruf.";

      if (finalPhone || finalEmail) {
        reply = "Danke. Ihre Rückruf-Anfrage wurde erfasst. Wir melden uns bei Ihnen.";
      }
    } else if (shouldSaveAsLead) {
      savedLead = await saveLead({
        name: finalName,
        phone: finalPhone,
        email: finalEmail,
        business,
        industry,
        message,
        interested_service: interested_service || "EmpfangAI Demo",
        notes,
        source,
        booking_link_sent: wantsBooking ? "Yes" : "No",
      });

      if (hasContactInfo && !isLead && !wantsBooking) {
        reply = "Danke. Ihre Kontaktdaten wurden erfasst. Wir melden uns bei Ihnen.";
      } else if (!wantsBooking && !finalPhone && !finalEmail) {
        reply += " Senden Sie mir gern Ihre E-Mail-Adresse oder Telefonnummer, damit wir Sie kontaktieren können.";
      }
    }

    if (wantsBooking) {
      bookingData = sendBookingLink();
      reply = `Gerne — hier können Sie direkt eine Demo buchen: ${BOOKING_LINK}`;

      if (!finalPhone && !finalEmail) {
        reply +=
          " Wenn Sie lieber kontaktiert werden möchten, senden Sie mir bitte Ihren Namen, Ihr Unternehmen und Ihre E-Mail-Adresse oder Telefonnummer.";
      }
    }

    return res.json({
      reply,
      leadDetected: shouldSaveAsLead,
      callbackRequested: wantsCallback,
      bookingRequested: wantsBooking,
      bookingLink: bookingData ? bookingData.bookingLink : null,
      savedLead: savedLead ? savedLead.success : false,
      savedCallback: callbackResult ? callbackResult.success : false,
    });
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Auf dem Server ist ein Fehler aufgetreten.",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
