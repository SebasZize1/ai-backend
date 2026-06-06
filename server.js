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
  process.env.BOOKING_LINK || "https://calendly.com/empfangai/termin-buchen";

// LANGUAGE MEMORY PER CONVERSATION
const conversationLanguages = new Map();

const languagePreferencePatterns = [
  {
    code: "de",
    name: "Deutsch",
    regex: /\b(deutsch|auf deutsch|in deutsch|german|allemand)\b/i,
  },
  {
    code: "en",
    name: "English",
    regex: /\b(english|englisch|auf englisch|in english|anglais)\b/i,
  },
  {
    code: "fr",
    name: "Français",
    regex: /\b(französisch|franzoesisch|français|francais|french|auf französisch|auf franzoesisch|en français|en francais)\b/i,
  },
  {
    code: "nl",
    name: "Nederlands",
    regex: /\b(niederländisch|niederlaendisch|holländisch|hollaendisch|dutch|nederlands|vlaams|flämisch|flaemisch)\b/i,
  },
  {
    code: "tr",
    name: "Türkçe",
    regex: /\b(türkisch|tuerkisch|turkish|türkçe|turkce|auf türkisch|auf tuerkisch)\b/i,
  },
];

function detectLanguagePreference(message = "") {
  const languageActionRegex =
    /\b(sprich|sprechen|antworte|antworten|schreib|schreibe|speak|talk|answer|reply|respond|write|parle|parler|réponds|reponds|répondre|repondre|spreek|antwoord|schrijf|konuş|konus|cevap)\b/i;

  const hasLanguageAction = languageActionRegex.test(message);

  const matchedLanguage = languagePreferencePatterns.find((lang) =>
    lang.regex.test(message)
  );

  if (hasLanguageAction && matchedLanguage) {
    return matchedLanguage;
  }

  return null;
}
/**
 * -----------------------------
 * HELPERS
 * -----------------------------
 */

function getTimestamp() {
  const now = new Date();

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

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
    
        // English
    "appointment",
    "booking",
    "schedule",
    "pricing",
    "cost",
    "dentist",
    "doctor",
    "law firm",
    "real estate",

    // French
    "rendez-vous",
    "rdv",
    "démo",
    "demo",
    "appel",
    "rappel",
    "prix",
    "coût",
    "cout",
    "tarif",
    "dentiste",
    "médecin",
    "medecin",
    "cabinet médical",
    "cabinet medical",
    "avocat",
    "agence immobilière",
    "agence immobiliere",

    // Dutch
    "afspraak",
    "terugbellen",
    "prijs",
    "kosten",
    "tandarts",
    "huisarts",
    "advocaat",
    "makelaar",

    // Turkish
    "randevu",
    "geri arama",
    "fiyat",
    "ücret",
    "ucret",
    "dişçi",
    "disci",
    "doktor",
    "avukat",
    "emlak",
    "tamirci",
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
        // English
    "appointment",
    "booking",
    "schedule",
    "pricing",
    "cost",
    "dentist",
    "doctor",
    "law firm",
    "real estate",

    // French
    "rendez-vous",
    "rdv",
    "démo",
    "demo",
    "appel",
    "rappel",
    "prix",
    "coût",
    "cout",
    "tarif",
    "dentiste",
    "médecin",
    "medecin",
    "cabinet médical",
    "cabinet medical",
    "avocat",
    "agence immobilière",
    "agence immobiliere",

    // Dutch
    "afspraak",
    "terugbellen",
    "prijs",
    "kosten",
    "tandarts",
    "huisarts",
    "advocaat",
    "makelaar",

    // Turkish
    "randevu",
    "geri arama",
    "fiyat",
    "ücret",
    "ucret",
    "dişçi",
    "disci",
    "doktor",
    "avukat",
    "emlak",
    "tamirci",
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
        // French
    "appelez-moi",
    "appelez moi",
    "rappel",
    "contactez-moi",
    "contactez moi",
    "je veux être contacté",
    "je veux etre contacte",

    // Dutch
    "bel mij",
    "bel me",
    "terugbellen",
    "neem contact met mij op",
    "ik wil gecontacteerd worden",

    // Turkish
    "beni ara",
    "beni arayın",
    "beni arayin",
    "geri arama",
    "benimle iletişime geçin",
    "benimle iletisime gecin",
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
        // French
    "rendez-vous",
    "rdv",
    "prendre rendez-vous",
    "réserver",
    "reserver",
    "démo",
    "demo",

    // Dutch
    "afspraak",
    "afspraak maken",
    "demo boeken",

    // Turkish
    "randevu",
    "demo almak",
    "demo istiyorum",
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
  conversation_id = "",
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
    conversation_id,
    timestamp: getTimestamp(),
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
  conversation_id = "",
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
    conversation_id,
    timestamp: getTimestamp(),
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
  conversationId = "",
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
    const finalConversationId = conversationId || "conv_" + Date.now().toString();

    const languagePreference = detectLanguagePreference(message);
    const isLanguagePreferenceIntent = Boolean(languagePreference);

        if (isLanguagePreferenceIntent) {
          conversationLanguages.set(finalConversationId, languagePreference.code);
            }    

    const extracted = extractContactInfo(message);
    const hasContactInfo =
      !!extracted.extractedEmail || !!extracted.extractedPhone;

    const isLead = detectLeadIntent(message);
    const wantsCallback = detectCallbackIntent(message);
    const wantsBooking = detectBookingIntent(message);
    const keywordRelevant = isRelevantToEmpfangAI(message);

    const relevant =
    keywordRelevant ||
    hasContactInfo ||
    isLead ||
    wantsCallback ||
    wantsBooking ||
    isLanguagePreferenceIntent;
    
    const shouldLogMessage = hasContactInfo || isLead || wantsCallback || wantsBooking;
    const finalName = name && name !== "Website Visitor" ? name : extracted.extractedName || "";
    const finalEmail = email || extracted.extractedEmail || "";
    const finalPhone = phone || extracted.extractedPhone || "";

    console.log("Keyword relevant:", keywordRelevant);
    console.log("Has contact info:", hasContactInfo);
    console.log("Relevant:", relevant);
    console.log("Lead detected:", isLead);
    console.log("Should save as lead:", shouldLogMessage);
    console.log("Callback detected:", wantsCallback);
    console.log("Booking detected:", wantsBooking);
    console.log("Language preference:", languagePreference);
    console.log("Language preference intent:", isLanguagePreferenceIntent);
    console.log("Preferred conversation language:", conversationLanguages.get(finalConversationId));

    const pureLanguagePreference =
    isLanguagePreferenceIntent &&
    !hasContactInfo &&
    !isLead &&
    !wantsCallback &&
    !wantsBooking;
  
    if (pureLanguagePreference) {
      const languageReplies = {
        de: "Gerne — ich antworte ab jetzt auf Deutsch. Wie kann ich Ihnen zu EmpfangAI helfen?",
        en: "Sure — I can answer in English from now on. How can I help you with EmpfangAI?",
        fr: "Bien sûr — je peux répondre en français. Comment puis-je vous aider avec EmpfangAI ?",
        nl: "Natuurlijk — ik kan vanaf nu in het Nederlands antwoorden. Hoe kan ik u helpen met EmpfangAI?",
        tr: "Tabii — bundan sonra Türkçe cevap verebilirim. EmpfangAI konusunda size nasıl yardımcı olabilirim?",
      };
  
    return res.json({
      conversationId: finalConversationId,
      reply: languageReplies[languagePreference.code],
      leadDetected: false,
      callbackRequested: false,
      bookingRequested: false,
      bookingLink: null,
      savedLead: false,
      savedCallback: false,
    });
  }
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

  const preferredLanguage = conversationLanguages.get(finalConversationId);

const languageInstruction = preferredLanguage
  ? `Der Nutzer bevorzugt diese Sprache: ${preferredLanguage}. Antworte immer in dieser Sprache, außer der Nutzer ändert die Sprache ausdrücklich.`
  : `Erkenne die Sprache der letzten Nutzernachricht. Wenn sie Deutsch, Englisch, Französisch, Niederländisch oder Türkisch ist, antworte in derselben Sprache. Wenn die Sprache unklar ist, antworte auf Deutsch.`;

const instructions = `
Du bist der Website-Assistent von EmpfangAI.

Sprachregeln:
- ${languageInstruction}
- Die offiziell unterstützten Hauptsprachen sind Deutsch, Englisch, Französisch, Niederländisch und Türkisch.
- Wenn der Nutzer eine dieser Sprachen benutzt, antworte natürlich in dieser Sprache.

Regeln:
- Antworte kurz: maximal 1 bis 2 Sätze.
- Nur auf klare Nachfrage etwas ausführlicher.
- Bleibe beim Thema EmpfangAI, Unternehmen, Demo, Kosten, Einsatzmöglichkeiten, Lead-Erfassung und Terminbuchung.
- Keine langen Erklärungen.
- Keine irrelevanten Gespräche.
- Keine erfundenen Preise, Garantien oder Funktionen.

Ziel:
- kurz erklären, was EmpfangAI macht
- Demo-Buchung unterstützen
- Rückruf/Kontakt erfassen
`;

    console.log("About to call OpenAI...");

    const response = await Promise.race([
      client.responses.create({
        model: "gpt-4o-mini",
        instructions,
        input: message,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OpenAI timeout after 20s")), 20000)
      ),
    ]);

    console.log("OpenAI responded successfully");

    let reply =
      response.output_text ||
      "Gerne. Ich helfe Ihnen bei Fragen zu EmpfangAI.";

    let savedLead = null;
    let callbackResult = null;
    let bookingData = null;

    if (wantsCallback) {
      callbackResult = await requestCallback({
        conversation_id: finalConversationId,
        name: finalName,
        phone: finalPhone,
        email: finalEmail,
        business,
        industry,
        message,
        notes,
        source,
      });

      if (finalPhone || finalEmail) {
        reply = "Danke! Wir melden uns in Kürze bei Ihnen.";
      } else {
        reply = "Gerne. Senden Sie mir bitte Ihre Telefonnummer oder E-Mail-Adresse.";
      }
    } else if (shouldLogMessage) {
      savedLead = await saveLead({
        conversation_id: finalConversationId,
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

      if (wantsBooking) {
        bookingData = sendBookingLink();
        reply = `Gerne — hier können Sie direkt eine Demo buchen:<br><br><a href="${BOOKING_LINK}" target="_blank" rel="noopener noreferrer">Demo-Termin buchen</a>`;
      } else if (hasContactInfo && !isLead) {
        reply = "Danke! Wir melden uns in Kürze bei Ihnen.";
      } else if (!finalPhone && !finalEmail) {
        reply = "Gerne. Senden Sie mir bitte Ihre E-Mail-Adresse oder Telefonnummer.";
      } else {
        reply = "Danke! Wir melden uns in Kürze bei Ihnen.";
      }
    } else if (wantsBooking) {
      bookingData = sendBookingLink();
      reply = `Gerne — hier können Sie direkt eine Demo buchen:<br><br><a href="${BOOKING_LINK}" target="_blank" rel="noopener noreferrer">Demo-Termin buchen</a>`;
    }

    console.log("Sending final response to frontend");

    return res.json({
      conversationId: finalConversationId,
      reply,
      leadDetected: shouldLogMessage,
      callbackRequested: wantsCallback,
      bookingRequested: wantsBooking,
      bookingLink: bookingData ? bookingData.bookingLink : null,
      savedLead: savedLead ? savedLead.success : false,
      savedCallback: callbackResult ? callbackResult.success : false,
    });
  } catch (error) {
    console.error("Server error full:", error);
    console.error("Server error message:", error.message);
    console.error("Server error stack:", error.stack);

    return res.status(500).json({
      error: "Auf dem Server ist ein Fehler aufgetreten.",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
