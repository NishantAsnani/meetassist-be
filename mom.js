const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PDFDocument = require("pdfkit");

// ================= CONFIG =================
const CONFIG = {
  GEMINI_API_KEY: "AIzaSyDu-WOOF1PcWerK-GzPFpmveq8uw8P_zYM",
  MODEL_NAME: "gemini-2.5-flash",
  TRANSCRIPT_FILE: "meeting_2.txt",
  OUTPUT_PDF: "meeting_minutes.pdf",
  ROUND_LOGO: "round_logo.png",
  HORIZONTAL_LOGO: "hori_logo.png",
  TITLE: "Project Review Meeting"
};



// System prompt for the AI
const SYSTEM_PROMPT = `Role: You are an expert corporate secretary and project documentation assistant.

Task: Given a raw meeting transcript, extract all relevant information and generate a complete, professionally formatted Minutes of Meeting (MoM) using the following structure.

Instructions:
1. Identify and extract:
   * Meeting title
   * Date, time, venue/platform
   * Chairperson and minute taker
   * Attendees and their roles
   * Absentees (if mentioned)
   * Agenda items
   * Detailed discussion under each agenda
   * Decisions taken
   * Action items with owners and deadlines
   * Important observations
   * Next meeting details
   * Conclusion

2. Rewrite everything in:
   * Formal professional language
   * Clear bullet points
   * Third-person narrative
   * Past tense

3. Infer missing fields logically if not explicitly stated (mark them as "Not Specified" if impossible to infer).

4. Output must strictly follow this JSON format:
{
  "meetingTitle": "string",
  "project": "string",
  "date": "string",
  "time": "string",
  "venue": "string",
  "chairperson": "string",
  "minuteTaker": "string",
  "attendees": [{"name": "string", "role": "string"}],
  "absentees": [{"name": "string", "role": "string"}],
  "agenda": ["string"],
  "discussionPoints": [{"agendaItem": "string", "discussion": "string"}],
  "decisions": [{"decision": "string", "rationale": "string"}],
  "actionItems": [{"task": "string", "owner": "string", "deadline": "string"}],
  "observations": ["string"],
  "nextMeeting": {"date": "string", "time": "string", "venue": "string"},
  "conclusion": "string",
  "preparedBy": "string",
  "approvedBy": "string"
}

Perform:
1. Named Entity Recognition (People, Dates, Tasks)
2. Agenda segmentation
3. Decision extraction
4. Action item detection (Task, Owner, Deadline)
5. Responsibility mapping

Ensure:
- No hallucinations
- No missing fields unless truly unavailable
- Professional corporate language
- Return ONLY valid JSON, no markdown formatting or additional text`;

// ================= GEMINI =================
async function processTranscript(text) {
  const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: CONFIG.MODEL_NAME });
  const res = await model.generateContent(`${SYSTEM_PROMPT}\n\nTranscript:\n${text}`);
  const clean = res.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}


function section(doc, title) {
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#0b4f6c").text(title);
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#b0c4de");
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).fillColor("#333333");
}

function field(doc, label, value) {
  doc.font("Helvetica-Bold").fontSize(10).text(`${label}: `, { continued: true });
  doc.font("Helvetica").fontSize(10).text(value || "Not Specified");
}

async function generatePDF(data) {
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(CONFIG.OUTPUT_PDF);
  doc.pipe(stream);

  const roundLogoExists = fs.existsSync(CONFIG.ROUND_LOGO);
  const horiLogoExists = fs.existsSync(CONFIG.HORIZONTAL_LOGO);

  // Header Logo
  if (roundLogoExists) {
    doc.image(CONFIG.ROUND_LOGO, 250, 20, { width: 80 });
  }

  doc.moveDown(4);
  doc.font("Helvetica-Bold").fontSize(18).text(CONFIG.TITLE, { align: "center" });
  doc.moveDown(1.2);

  field(doc, "Date", data.date);
  field(doc, "Time", data.time);
  field(doc, "Venue", data.venue);
  field(doc, "Chairperson", data.chairperson);
  field(doc, "Minute Taker", data.minuteTaker);

  section(doc, "1. Attendees");
  data.attendees.forEach(a =>
    doc.text(`• ${a.name} — ${a.role}`, { indent: 20, align: "justify" })
  );

  section(doc, "2. Agenda");
  data.agenda.forEach(a =>
    doc.text(`• ${a}`, { indent: 20, align: "justify" })
  );

  section(doc, "3. Discussion Points");
  data.discussionPoints.forEach(d => {
    doc.font("Helvetica-Bold").text(`• ${d.agendaItem}`, { indent: 10 });
    doc.font("Helvetica").text(d.discussion, { indent: 30, align: "justify" });
    doc.moveDown(0.3);
  });

  section(doc, "4. Decisions Taken");
  data.decisions.forEach(d =>
    doc.text(`• ${d.decision}`, { indent: 20, align: "justify" })
  );

  section(doc, "5. Action Items");
  data.actionItems.forEach(a => {
    doc.text(`• Task: ${a.task}`, { indent: 20, align: "justify" });
    doc.text(`  Owner: ${a.owner}`, { indent: 30 });
    doc.text(`  Deadline: ${a.deadline}`, { indent: 30 });
    doc.moveDown(0.3);
  });

  section(doc, "6. Observations");
  data.observations.forEach(o =>
    doc.text(`• ${o}`, { indent: 20, align: "justify" })
  );

  section(doc, "7. Next Meeting");
  doc.text(`• Date: ${data.nextMeeting.date}`, { indent: 20 });
  doc.text(`• Time: ${data.nextMeeting.time}`, { indent: 20 });
  doc.text(`• Venue: ${data.nextMeeting.venue}`, { indent: 20 });

  section(doc, "8. Conclusion");
  doc.text(data.conclusion, { indent: 20, align: "justify" });

  // Approval block
  doc.moveDown(2);
  doc.font("Helvetica-Bold").text("Approval");
  doc.font("Helvetica").text("Approved by Admin");

  // Generated by with logo instead of text
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").text("Generated by");

  if (horiLogoExists) {
    doc.moveDown(0.3);
    doc.image(CONFIG.HORIZONTAL_LOGO, { width: 120 });
  }

  doc.end();

  stream.on("finish", () => {
    console.log("✅ Branded MoM PDF Generated:", CONFIG.OUTPUT_PDF);
  });
}



// ================= MAIN =================
async function main() {
  const transcript = fs.readFileSync(CONFIG.TRANSCRIPT_FILE, "utf-8");
  const momData = await processTranscript(transcript);
  await generatePDF(momData);
}

main();
