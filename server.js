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
  process.env.BOOKING_LINK || "https://calendly.com/dein-link/demo";

/**
 * -----------------------------
 * 1) HILFSFUNKTIONEN
 * -----------------------------
 */

function normalizeText(text) {
  return (text || "").toLowerCase().trim();
}

function containsAny(text, keywords) {
  return keywords.some((word) => text.includes(word));
}

/**
 * -----------------------------
 * 2) RELEVANZ-ERKENNUNG
 * -----------------------------
 * Entscheidet:
 * Ist die Nachricht überhaupt relevant für EmpfangAI?
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
    "kanzlei",
    "makler",
    "werkstatt",
    "zahnarzt",
    "hausarzt",
    "kundensupport",
    "anfragen",
    "kontakt",
    "rückruf",
    "callback",
    "preis",
    "preise",
    "kosten",
    "service",
    "funktioniert",
    "wie geht",
    "wie läuft",
    "einrichtung"
  ];

  return containsAny(text, relevantKeywords);
}

/**
 * -----------------------------
 * 3) INTENT-DETEKTOREN
 * -----------------------------
 */

function detectLeadIntent(message) {
  const text = normalizeText(message);

  const leadKeywords = [
    "demo",
    "termin",
    "termin buchen",
    "buchen",
    "buchung",
    "meeting",
    "beratung",
    "interessiert",
    "ich habe interesse",
    "kontakt",
    "in kontakt",
    "kontaktieren",
    "get in contact",
    "get in touch",
    "speak to someone",
    "mit jemandem sprechen",
    "rückruf",
    "callback",
    "call back",
    "call me",
    "contact me",
    "preis",
    "preise",
    "kosten",
    "angebot",
    "law firm",
    "dentist",
    "clinic",
    "business",
    "für meine firma",
    "für mein unternehmen",
    "für meine praxis",
    "für meine kanzlei",
    "für meine werkstatt"
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
    "call me",
    "call back",
    "contact me",
    "kontaktieren sie mich",
    "ich möchte kontaktiert werden",
    "ich möchte sprechen",
    "in kontakt",
    "get in touch",
    "get in contact"
  ];

  return containsAny(text, callbackKeywords);
}

function detectBookingIntent(message) {
  const text = normalizeText(message);

  const bookingKeywords = [
    "demo",
    "demo buchen",
    "termin",
    "termin buchen",
    "meeting",
    "beratung",
    "buchung",
    "buchen",
    "appointment",
    "schedule"
  ];

  return containsAny(text, bookingKeywords);
}

function extractContactInfo(rawText = "") {
  const text = String(rawText);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(\+?\d[\d\s()/.-]{6,}\d)/);
  const nameMatch = text.match(
    /\b([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)\b/
  );

  return {
    extractedEmail: emailMatch ? emailMatch[0] : "",
    extractedPhone: phoneMatch ? phoneMatch[0] : "",
    extractedName: nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : "",
  };
}

/**
 * -----------------------------
 * 4) MAKE-WEBHOOK
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
 * 5) TOOL-AKTIONEN
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
    booking_link_sent: "No",
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
 * 6) ROUTES
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

    const relevant = isRelevantToEmpfangAI(message);
    const isLead = detectLeadIntent(message);
    const wantsCallback = detectCallbackIntent(message);
    const wantsBooking = detectBookingIntent(message);

    const extracted = extractContactInfo(message);

    const finalName =
      name && name !== "Website Visitor" ? name : extracted.extractedName || "";
    const finalEmail = email || extracted.extractedEmail || "";
    const finalPhone = phone || extracted.extractedPhone || "";

    console.log("Relevant:", relevant);
    console.log("Lead detected:", isLead);
    console.log("Callback detected:", wantsCallback);
    console.log("Booking detected:", wantsBooking);

    if (!relevant) {
      return res.json({
        reply:
          "Ich bin hier, um Fragen zu EmpfangAI zu beantworten. Ich helfe Unternehmen zu verstehen, wie unser KI-Assistent Kundenanfragen beantwortet, Leads erfasst und bei Terminbuchungen unterstützt. Sie können mich zum Beispiel nach einer Demo, dem Ablauf, Einsatzmöglichkeiten oder den Kosten fragen.",
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

Dein Zweck:
- Erkläre Unternehmern klar und kurz, was EmpfangAI macht.
- EmpfangAI hilft lokalen Unternehmen dabei, Kundenfragen automatisch zu beantworten, Anfragen zu erfassen und bei Terminbuchungen zu unterstützen.
- Führe interessierte Besucher zu einer Demo oder zu einer Rückruf-Anfrage.

Wichtige Verhaltensregeln:
- Antworte immer auf Deutsch.
- Bleibe fokussiert auf EmpfangAI und den Nutzen für Unternehmen.
- Wenn eine Frage unklar, albern oder nicht relevant ist, leite höflich zurück zum eigentlichen Zweck.
- Führe keine belanglosen oder spielerischen Unterhaltungen.
- Erfinde keine Preise, Garantien oder Funktionen.
- Wenn jemand Interesse zeigt, fordere wenn nötig Name, E-Mail, Telefonnummer und Unternehmen an.
- Wenn jemand eine Demo möchte, erwähne die Möglichkeit zur Terminbuchung.
- Wenn jemand kontaktiert werden möchte, fordere die Kontaktdaten an.

Typische Themen:
- Demo
- Preise / Kosten
- Einrichtung
- Einsatzmöglichkeiten
- Branchen
- Lead-Erfassung
- Terminbuchung
- Rückruf

Stil:
- professionell
- freundlich
- kurz
- klar
- verkaufsorientiert, aber nicht aufdringlich
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      instructions,
      input: message,
    });

    let reply =
      response.output_text ||
      "Danke für Ihre Nachricht. Ich helfe Ihnen gerne bei Fragen zu EmpfangAI.";

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

      if (!finalPhone && !finalEmail) {
        reply +=
          " Damit wir Sie erreichen können, senden Sie bitte noch Ihre Telefonnummer oder E-Mail-Adresse.";
      }
    } else if (isLead) {
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
      });

      if (!finalPhone && !finalEmail) {
        reply +=
          " Wenn Sie möchten, können Sie mir auch direkt Ihre E-Mail-Adresse oder Telefonnummer senden, damit wir Sie kontaktieren können.";
      }
    }

    if (wantsBooking) {
      bookingData = sendBookingLink();
      reply += ` Hier können Sie direkt eine Demo buchen: ${BOOKING_LINK}`;
    }

    return res.json({
      reply,
      leadDetected: isLead,
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
