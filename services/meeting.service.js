const {formatTime, getOAuthClient}=require('../utils/helper');
const { AssemblyAI } = require('assemblyai');
const {uploadTextFile}=require('../utils/helper');
const meetingMetric=require('../models/meetingMetrics');
const meeting=require('../models/meetings');
const { google } = require("googleapis");
const User = require("../models/users");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fs = require('fs');


const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    temperature: 0.1, 
    maxOutputTokens: 2000,
  },
});

async function processAudioFile(file,userId) {
    try {
        const client = new AssemblyAI({
    apiKey:process.env.ASSEMBLY_AI_KEY
});
    const startTime = Date.now(); 

      const transcript = await client.transcripts.transcribe({
        audio:file.buffer,
        speaker_labels: true 
      });
    
      const endTime = Date.now(); 
      const processingTimeMs = endTime - startTime;
    
      if (transcript.status === 'error') {
        console.error(`Transcription failed: ${transcript.error}`);
        return;
      }
    
      let formattedTranscript = '';
    
    
      for (let utterance of transcript.utterances) {
        const start = formatTime(utterance.start);
        const end = formatTime(utterance.end);
        formattedTranscript += `[${start} - ${end}] Speaker ${utterance.speaker}: ${utterance.text}\n`;
      }

      const textBuffer = Buffer.from(formattedTranscript, 'utf-8');


      const texFile=await uploadTextFile( textBuffer , userId);



      

      console.log(
        ` Processing time: ${formatTime(processingTimeMs)} (${processingTimeMs} ms)`
      );
    
    return {
        status: 'success',
        message: 'File processed successfully',
        data: {textFile: texFile.data,transcript: formattedTranscript},
    }

    } catch (err) {
        console.error("Error processing audio file:", err);
        throw new Error(err);
    }
}

async function addMeetingMetrics(metricsResponse,meetingId){
    try{
        const metrics = {
            engagement_score: metricsResponse.engagement_score,
            speaker_balance: metricsResponse.speaker_balance,
            meetingId: meetingId,
            silence_ratio: metricsResponse.silence_ratio,
            off_topic_score: metricsResponse.off_topic_score,
            conflict_level: metricsResponse.conflict_level,
            time_utilization: metricsResponse.time_utilization,
            meeting_resolution: metricsResponse.meeting_resolution,
            meeting_roi: metricsResponse.meeting_roi
        }

        await meetingMetric.create(metrics);

        await meeting.findByIdAndUpdate(meetingId, {
            short_summary: metricsResponse.short_summary,
            long_summary: metricsResponse.long_summary,
            improvements: metricsResponse.improvements
        });

        return {
            status: 'success',
            message: 'Meeting metrics added successfully',
            data: metrics,
        }

    }catch(err){
        throw new Error(err);
    }
}

async function syncGoogleCalenderToDB(userId) {
  try {
    const user = await User.findById(userId);
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(user.googleTokens);
    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

    const allEvents = [];
    let pageToken = null;

    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: new Date(0).toISOString(),
        singleEvents: true,                 
        showDeleted: true,                  
        maxResults: 250,
        pageToken
      });

      const events = res.data.items || [];

      for (const event of events) {
        allEvents.push({
          google_event_id: event.id,
          calendar_id: event.organizer?.email || "primary",
          summary: event.summary || "(No title)",
          description: event.description || null,
          start_time: event.start?.dateTime || event.start?.date || null,
          end_time: event.end?.dateTime || event.end?.date || null,
          meet_link: event.hangoutLink || null,
        });
      }

      pageToken = res.data.nextPageToken;
    } while (pageToken);

    for (const eventData of allEvents) {
      const existingMeeting = await meeting.findOne({
        googleEventId: eventData.google_event_id,
        userId: userId
      });

      if (!existingMeeting) {
        await meeting.create({
          title: eventData.summary,
          startedAt: eventData.start_time,
          endedAt: eventData.end_time,
          userId: userId,
          googleCalendarId: eventData.calendar_id,
          googleEventId: eventData.google_event_id,
          lastSyncedAt: new Date()
        });
      }
    }
  } catch (err) {
    throw new Error(err);
  }

}

async function analyzeTranscriptFile(meetingId,textFile) {
  try {
    const PROMPT = `
        Act as a professional Meeting Analyst. Your task is to analyze the provided timestamped transcript and return a structured analysis strictly in JSON format. [1]

        Analysis Instructions: [1]
        1. Metric Name & Evaluation: [1]
        - Engagement Score: (0 – 10) Measure involvement based on responsiveness and activity. [1]
        - Speaker Balance: (balanced / skewed / dominated) Distribution of speaking time. [1]
        - Silence Ratio: (low / medium / high) Dead air based on timestamp gaps. [1]
        - Off-Topic Score: (0 – 10) Degree of deviation from core objectives. [1]
        - Conflict Level: (none / low / medium / high) Degree of disagreement or tension. [2]
        - Time Utilization: (poor / fair / good / excellent) Effectiveness of time used versus information conveyed. [2]
        - Meeting Resolution: (success / partial / failed / inconclusive) Achievement of clear outcomes. [2]
        - Meeting ROI: (poor / fair / good / excellent) Value relative to time invested. [2]

        2. Summaries: [2]
        - Short Summary: A one-sentence executive summary. [2]
        - Long Summary: A detailed paragraph covering key themes, technical points, and conclusions. [2]

        3. Improvements: A list of actionable feedback points. [3]

        One-Shot Example: [3]
        Input: [00:00:00 - 00:00:10] Speaker A: Welcome. Today we decide on the new logo. [00:00:11 - 00:00:20] Speaker B: I prefer the blue one; it's more professional. [00:00:21 - 00:00:25] Speaker A: Done. Blue it is. [3]
        Output: {
        "metrics": {
            "engagement_score": 10,
            "speaker_balance": "balanced",
            "silence_ratio": "low",
            "off_topic_score": 0,
            "conflict_level": "none",
            "time_utilization": "excellent",
            "meeting_resolution": "success",
            "meeting_roi": "excellent"
        },
        "summaries": {
            "short_summary": "The team quickly reached a consensus on the new logo color.",
            "long_summary": "In a very brief session, Speaker A initiated a vote on the new logo. Speaker B provided a preference for blue based on professional aesthetics, which was immediately adopted as the final decision."
        },
        "feedback": {
            "improvements": ["The meeting was efficient but lacked a discussion of alternative colors."]
        }
        } [3-5]

        Current Task:
        Analyze the following timestamped transcript: [5]
        ${textFile}

        IMPORTANT OUTPUT RULES:
        - Return ONLY a valid JSON object.
        - Do NOT include explanations, markdown, or text outside JSON.
        - Do NOT wrap the output in code fences.
        - The response MUST start with '{' and end with '}'.

        JSON Schema (strict):
        {
        "metrics": {
            "engagement_score": number,
            "speaker_balance": string,
            "silence_ratio": string,
            "off_topic_score": number,
            "conflict_level": string,
            "time_utilization": string,
            "meeting_resolution": string,
            "meeting_roi": string
        },
        "summaries": {
            "short_summary": string,
            "long_summary": string
        },
        "feedback": {
            "improvements": string[]
        }
        }
        `;

    // Execute with retry logic from our conversation history
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const result = await model.generateContent(PROMPT);
        const text = result.response.text();


        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");

        const data = JSON.parse(jsonMatch);

        const metrics={
            engagement_score: data.metrics.engagement_score,
            speaker_balance: data.metrics.speaker_balance,
            silence_ratio: data.metrics.silence_ratio,
            off_topic_score: data.metrics.off_topic_score,
            conflict_level: data.metrics.conflict_level,
            time_utilization: data.metrics.time_utilization,
            meeting_resolution: data.metrics.meeting_resolution,
            meeting_roi: data.metrics.meeting_roi,
            meetingId: meetingId
        }

        await meetingMetric.create(metrics);

        await meeting.findByIdAndUpdate(meetingId, {
            short_summary: data.summaries.short_summary,
            long_summary: data.summaries.long_summary,
            improvements: data.feedback.improvements
        });

        return {
            status: 'success',
            message: 'Meeting metrics added successfully',
            data: metrics,
        }
      } catch (err) {
        console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
        if (err.message.includes("503") || err.message.includes("overloaded")) {
          console.log("Waiting 5 seconds before retry...");
          await wait(5000); // Wait 5 seconds for server capacity
        }
        if (attempt === 10) throw err;
      }
    }
  } catch (fileErr) {
    console.error(`❌ Error reading file or processing: ${fileErr.message}`);
  }
}




module.exports={
    processAudioFile,
    addMeetingMetrics,
    syncGoogleCalenderToDB,
    analyzeTranscriptFile
}