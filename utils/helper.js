const {createClient} = require('@supabase/supabase-js');
const multer = require('multer');
const supabaseUrl=process.env.SUPABASE_PROJECT_URL;
const supabaseKey=process.env.SUPABASE_SECRET_KEY;
const supabaseClient=createClient(supabaseUrl,supabaseKey);
const upload = multer({ storage: multer.memoryStorage() });
const {google}=require("googleapis");
const fs= require("fs");
const PDFDocument = require("pdfkit");

async function uploadAudioFile(file,userId){
    try{
        const { data, error } = await supabaseClient.storage
            .from('SAIL')
            .upload(`${userId}/audio/${Date.now()}-${file.originalname}`, file.buffer, {
                contentType: file.mimetype,
            });

        if (error) {
            console.log("Supabase Upload Error: ", error);
            return {
                status: 'error',
                message: 'File upload failed',
                data:null
            };
        }

        else{
            return{
                status:'success',
                message:'File uploaded successfully',
                data:data,
            }
        }
        
    }catch(err){
        throw new Error(err);
    }
}

async function uploadTextFile(textBuffer, userId) {
    try {
        const realBuffer = Buffer.isBuffer(textBuffer)
            ? textBuffer
            : Buffer.from(textBuffer.data);
        const { data, error } = await supabaseClient.storage
            .from('SAIL')
            .upload(`${userId}/text/${Date.now()}-transcribeFile`, realBuffer, {
                contentType: 'text/plain',
                upsert: true,
            });



        if (error) {
            console.log("Supabase Upload Error: ", error);
            return {
                status: 'error',
                message: 'File upload failed',
                data: null
            };
        }

        else {
            return {
                status: 'success',
                message: 'File uploaded successfully',
                data: data,
            }
        }

    } catch (err) {
        throw new Error(err);
    }
}

async function uploadPdfFile(pdfBuffer, userId) {
    try {
        const realBuffer = Buffer.isBuffer(pdfBuffer)
            ? pdfBuffer
            : Buffer.from(pdfBuffer.data);
        const { data, error } = await supabaseClient.storage
            .from('SAIL')
            .upload(`${userId}/pdf/${Date.now()}-meetingMinutes`, realBuffer, {
                contentType: 'application/pdf',
                upsert: true,
            });



        if (error) {
            console.log("Supabase Upload Error: ", error);
            return {
                status: 'error',
                message: 'File upload failed',
                data: null
            };
        }

        else {
            return {
                status: 'success',
                message: 'File uploaded successfully',
                data: data,
            }
        }

    } catch (err) {
        throw new Error(err);
    }
}

async function getFileFromSupabase(filePath) {
  try {
    const { data, error } = await supabaseClient.storage
      .from("SAIL")
      .download(filePath);

    if (error) {
      console.error("Supabase Download Error:", error);
      return {
        status: "error",
        message: "File download failed",
        data: null,
      };
    }

    // Convert Blob → Buffer (Node.js)
    const buffer = Buffer.from(await data.arrayBuffer());

    return {
      status: "success",
      message: "File downloaded successfully",
      data: buffer,
    };

  } catch (err) {
    console.error("getFileFromSupabase Exception:", err);
    throw err;
  }
}


const formatTime = (ms) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

function getOAuthClient() {
  return new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
}

function getJiraOAuthClient() {
  return new google.auth.OAuth2(
  process.env.JIRA_CLIENT_ID,
    process.env.JIRA_CLIENT_SECRET,
    process.env.JIRA_REDIRECT_URI
);
}

async function getSignedUrl(filePath) {
    const { data, error } = await supabaseClient.storage
      .from("SAIL")
      .createSignedUrl(filePath,300);

      return data;
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

async function generatePDF(data, meeting) {
  const doc = new PDFDocument({ margin: 50 });
  const CONFIG = {
  ROUND_LOGO: "round_logo.png",
  HORIZONTAL_LOGO: "hori_logo.png",
};


  const chunks = [];
  doc.on("data", chunk => chunks.push(chunk));

  const roundLogoExists = fs.existsSync(CONFIG.ROUND_LOGO);
  const horiLogoExists = fs.existsSync(CONFIG.HORIZONTAL_LOGO);

  // Header Logo
  if (roundLogoExists) {
    doc.image(CONFIG.ROUND_LOGO, 250, 20, { width: 80 });
  }

  doc.moveDown(4);
  doc.font("Helvetica-Bold").fontSize(18).text(meeting.title, { align: "center" });
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

  // Generated by
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").text("Generated by");

  if (horiLogoExists) {
    doc.moveDown(0.3);
    doc.image(CONFIG.HORIZONTAL_LOGO, { width: 120 });
  }

  doc.end();

  return new Promise(resolve => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });
  });
}




module.exports={
    uploadAudioFile,
    uploadTextFile,
    upload,
    formatTime,
    getOAuthClient,
    getJiraOAuthClient,
    getFileFromSupabase,
    getSignedUrl,
    generatePDF,
    uploadPdfFile
}