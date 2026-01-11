const { uploadAudioFile,getSignedUrl } = require('../utils/helper');
const { sendSuccessResponse,sendErrorResponse } = require('../utils/response');
const { STATUS_CODE } = require('../utils/constants');
const meetingServices = require('../services/meeting.service');
const meeting=require('../models/meetings');
const meetingMetric=require('../models/meetingMetrics');


async function uploadAndProcessFile(req,res){
    try{
    const file=req.file;
    const userId=req.user.id;
    const meetingId=req.body.meetingId;

    const uploadFile=await uploadAudioFile(file,userId);



    if(uploadFile.status!='success'){
        return sendErrorResponse(
            res,
            uploadFile.data,
            uploadFile.message,
            STATUS_CODE.SERVER_ERROR
        )
    }

    

    // Placeholder for processing logic (e.g., transcription, summarization)

    const processFile=await meetingServices.processAudioFile(file,userId)

    if(processFile.status!='success'){  
        return sendErrorResponse(
            res,
            {},
            "Error processing file",
            STATUS_CODE.SERVER_ERROR
        )
    }

    await meeting.findByIdAndUpdate(meetingId,{
        audioFilePath:uploadFile.data.fullPath,
        textFilePath:processFile.data.textFile.fullPath
    });

    const textFile=await getSignedUrl(processFile.data.textFile.path);

    const analyzeTextFile=await meetingServices.analyzeTranscriptFile(meetingId,processFile.data.transcript);

    const Mom=await meetingServices.generateMom(meetingId,processFile.data.transcript);

    return sendSuccessResponse(
        res,
        {audioFile:uploadFile.data,textFile},
        "File uploaded and processed successfully",
        STATUS_CODE.SUCCESS
    )


    
    }catch(err){
        console.log(err)
        return sendErrorResponse(
            res,
            {},
            "Internal Server Error",
            STATUS_CODE.SERVER_ERROR
        )
    }
}

async function getMeetingMetrics(req,res){
    try{
        const meetingId=req.params.id;

        console.log("Meeting ID: ", meetingId);
        
        const meetingMetrics=await meetingMetric.findOne({meetingId:meetingId});

        if(!meetingMetrics){
            return sendErrorResponse(
                res,
                meetingMetrics,
                "Meeting metrics not found",
                STATUS_CODE.NOT_FOUND
            )
        }

        return sendSuccessResponse(
            res,
            meetingMetrics,
            "Meeting metrics retrieved successfully",
            STATUS_CODE.SUCCESS
        )
    }catch(err){    
        console.log(err)
        return sendErrorResponse(
            res,
            {},
            "Internal Server Error",
            STATUS_CODE.SERVER_ERROR
        )
    }
}       

async function getAllMeetings(req,res){
    try{
        const userId=req.user.id;
        const meetings=await meeting.find({userId:userId}).sort({createdAt:-1});
        return sendSuccessResponse(
            res,
            meetings,
            "Meetings retrieved successfully",
            STATUS_CODE.SUCCESS
        )
    }catch(err){
        console.log(err)
        return sendErrorResponse(
            res,
            {},
            "Internal Server Error",
            STATUS_CODE.SERVER_ERROR
        )
    }
}

async function getMeetingById(req,res){
    try{
        const meetingId=req.params.id;
        const meetingData=await meeting.findById(meetingId);

        if(!meetingData){
            return sendErrorResponse(
                res,
                {},
                "Meeting not found",
                STATUS_CODE.NOT_FOUND
            )
        }
        return sendSuccessResponse(
            res,
            meetingData,
            "Meeting retrieved successfully",
            STATUS_CODE.SUCCESS
        )
    }
    catch(err){
        console.log(err)
        return sendErrorResponse(
            res,
            {},
            "Internal Server Error",
            STATUS_CODE.SERVER_ERROR
        )
    }
}

async function chatBotResponse(req, res) {
  try {
    const { meetingId, question } = req.body;

    const meetingData = await meeting.findById(meetingId);

    const textFile = await getSignedUrl(meetingData.textFilePath.split('SAIL/')[1]);
    const response = await fetch(textFile.signedUrl);

    const transcriptText = await response.text();


    if (!transcriptText || !question) {
      return sendErrorResponse(
        res,
        {},
        "transcriptText and question are required",
        STATUS_CODE.BAD_REQUEST
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY missing");
    }


    const CHUNK_CHAR_LIMIT = Number(process.env.RAG_CHUNK_CHAR_LIMIT ?? 1200);
    const TOP_K = Number(process.env.RAG_TOP_K ?? 3);
    const SIMILARITY_THRESHOLD = Number(process.env.RAG_SIMILARITY_THRESHOLD ?? 0.05);
    const HIGH_LEVEL_THRESHOLD = Number(process.env.RAG_HIGH_LEVEL_THRESHOLD ?? 0.02);
    const MAX_OUTPUT_TOKENS = Number(process.env.RAG_MAX_OUTPUT_TOKENS ?? 512);



    const parseTranscript = text => {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const parsed = [];

      for (const line of lines) {
        const match = line.match(
          /^\[(\d{2}:\d{2}:\d{2})(?:\s*-\s*(\d{2}:\d{2}:\d{2}))?\]\s*([^:]+):\s*(.+)$/
        );
        if (match) {
          parsed.push({
            startTime: match[1],
            endTime: match[2] ?? match[1],
            speaker: match[3].trim(),
            text: match[4].trim()
          });
        }
      }
      return parsed;
    };

    const createChunks = (parsed, rawText) => {
      if (parsed.length) {
        const chunks = [];
        let buffer = "";

        for (const e of parsed) {
          const line = `[${e.startTime} - ${e.endTime}] ${e.speaker}: ${e.text}\n`;
          if ((buffer + line).length > CHUNK_CHAR_LIMIT) {
            if (buffer.trim()) chunks.push(buffer.trim());
            buffer = line;
          } else {
            buffer += line;
          }
        }
        if (buffer.trim()) chunks.push(buffer.trim());
        return chunks;
      }

      const chunks = [];
      let buffer = "";
      for (const line of rawText.split("\n")) {
        if ((buffer + line).length > CHUNK_CHAR_LIMIT) {
          if (buffer.trim()) chunks.push(buffer.trim());
          buffer = line + "\n";
        } else {
          buffer += line + "\n";
        }
      }
      if (buffer.trim()) chunks.push(buffer.trim());
      return chunks;
    };

    const createEmbedding = async text => {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] }
          })
        }
      );

      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      return d.embedding.values;
    };

    const cosineSimilarity = (a, b) => {
      const dot = a.reduce((s, v, i) => s + v * b[i], 0);
      const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
      const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
      return dot / (magA * magB);
    };

    const isHighLevelQuestion = q =>
      [
        /summary/i,
        /overview/i,
        /agenda/i,
        /what.*meeting.*about/i,
        /key.*point/i,
        /main.*topic/i
      ].some(r => r.test(q));

    const generateAnswer = async (question, context, highLevel) => {
      const prompt = `You are an AI assistant answering questions about a meeting transcript.

Meeting Transcript Context:
${context}

User Question: ${question}

INSTRUCTIONS:
- Answer ONLY using the transcript context
- If the answer is not present, say: "I don't see that information in this meeting."
${highLevel ? "- Summarize main topics." : "- Provide specific details."}

Answer:`;

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: MAX_OUTPUT_TOKENS
            }
          })
        }
      );

      if (!r.ok) throw new Error(`Generation failed: ${r.status}`);
      const d = await r.json();
      return d?.candidates?.[0]?.content?.parts?.[0]?.text
        ?? "I don't see that information in this meeting.";
    };

    /* -------------------- PIPELINE -------------------- */

    const parsed = parseTranscript(transcriptText);
    const chunks = createChunks(parsed, transcriptText);

    if (!chunks.length) {
      return sendSuccessResponse(
        res,
        { answer: "No usable transcript found", confidenceScore: 0 },
        "Chatbot response generated",
        STATUS_CODE.SUCCESS
      );
    }

    const embedded = [];
    for (const c of chunks) {
      embedded.push({ text: c, embedding: await createEmbedding(c) });
    }

    const qEmbedding = await createEmbedding(question);

    const ranked = embedded
      .map(c => ({
        score: cosineSimilarity(qEmbedding, c.embedding),
        text: c.text
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    const highLevel = isHighLevelQuestion(question);
    const threshold = highLevel ? HIGH_LEVEL_THRESHOLD : SIMILARITY_THRESHOLD;

    if (!ranked.length || ranked[0].score < threshold) {
      return sendSuccessResponse(
        res,
        {
          answer: "I don't see that information in this meeting.",
          confidenceScore: ranked[0]?.score ?? 0
        },
        "Chatbot response generated",
        STATUS_CODE.SUCCESS
      );
    }

    const context = ranked.map(r => r.text).join("\n\n");
    const answer = await generateAnswer(question, context, highLevel);

    return sendSuccessResponse(
      res,
      {
        answer,
        confidenceScore: ranked[0].score,
        usedChunks: ranked.length
      },
      "Chatbot response generated",
      STATUS_CODE.SUCCESS
    );

  } catch (err) {
    console.error(err);
    return sendErrorResponse(
      res,
      {},
      "Internal Server Error",
      STATUS_CODE.SERVER_ERROR
    );
  }
}



module.exports={
    uploadAndProcessFile,
    getMeetingMetrics,
    getAllMeetings,
    getMeetingById,
    chatBotResponse
}