const {formatTime, getOAuthClient, uploadPdfFile,generatePDF}=require('../utils/helper');
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
const meetingTask=require('../models/meetingTasks');

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

async function syncGoogleCalenderToDB(user) {
  try {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(user.googleTokens);
    
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 1. Get all Calendar IDs
    const calendarListResponse = await calendar.calendarList.list();
    const calendarIds = calendarListResponse.data.items.map((c) => c.id);

    const allEvents = [];

    // 2. Loop through EACH calendar
    for (const calId of calendarIds) {
      let pageToken = null;
      
      // 3. Inner Loop: Pagination for the specific calendar
      do {
        try {
          const res = await calendar.events.list({
            calendarId: calId,
            timeMin: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString(), // Sync last 6 months only (Safer)
            singleEvents: true,
            showDeleted: false, // Usually you don't want deleted events in DB
            maxResults: 2500, // Maximize page size to reduce API calls
            pageToken: pageToken,
          });

          const events = res.data.items || [];

          for (const event of events) {
            // Only add events that have summary and time
            if(event.summary && (event.start?.dateTime || event.start?.date)) {
                allEvents.push({
                    google_event_id: event.id,
                    calendar_id: calId, // Use the actual calendar ID loop variable
                    summary: event.summary,
                    description: event.description || "",
                    start_time: event.start?.dateTime || event.start?.date,
                    end_time: event.end?.dateTime || event.end?.date,
                    meet_link: event.hangoutLink || null,
                });
            }
          }

          pageToken = res.data.nextPageToken;
        } catch (calErr) {
          console.error(`Failed to sync calendar ${calId}:`, calErr.message);
          // Continue to next calendar even if one fails
          break; 
        }
      } while (pageToken);
    }

    if (allEvents.length === 0) return;

    // 4. BULK WRITE (Performance: 1 DB call instead of thousands)
    const bulkOps = allEvents.map((eventData) => ({
      updateOne: {
        filter: { googleEventId: eventData.google_event_id, userId: user.id },
        update: {
          $set: {
            title: eventData.summary,
            startedAt: eventData.start_time,
            endedAt: eventData.end_time,
            googleCalendarId: eventData.calendar_id,
            googleEventId: eventData.google_event_id,
            lastSyncedAt: new Date(),
            // Add description/link if your schema supports it
          },
        },
        upsert: true, // Creates if it doesn't exist, Updates if it does
      },
    }));

    if (bulkOps.length > 0) {
      await meeting.bulkWrite(bulkOps);
    }
    
    console.log(`Synced ${allEvents.length} events for user ${user.id}`);

  } catch (err) {
    console.error("Critical Sync Error:", err);
    throw new Error(err.message);
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

    const TASKS_PROMPT=`
        Act as a professional Meeting Intelligence Analyst. Your task is to analyze a timestamped, speaker-diarized meeting transcript and extract structured insights strictly in JSON format.

        ANALYSIS OBJECTIVES:

        1) DISCUSSION ITEMS:
        Identify all distinct things that were discussed during the meeting.
        For each item, provide:
        - title: A concise name of the discussed item
        - description: A short, clear description (1–2 lines)
        - category: One of ["task", "story", "bug", "error"]
        - jira_recommended: "yes" or "no"
        - Use "yes" ONLY if the discussion indicates:
            • work to be tracked
            • an issue to be fixed
            • a task requiring follow-up
            • a feature, requirement, or investigation
        - Use "no" for purely informational or contextual discussion

        2) NEXT ACTIONS:
        Identify all explicit or implied next steps mentioned in the meeting.
        For each action, provide:
        - action_item: A concise description of what needs to be done
        - description: Short explanation of the action
        - deadline: 
        - Use an explicit date if mentioned
        - Otherwise use:
            • "immediate"
            • "this week"
            • "next week"
            • "unspecified"

        IMPORTANT INTERPRETATION RULES:
        - Use ONLY the information present in the transcript.
        - Do NOT invent tasks, deadlines, or intentions.
        - If a deadline is not mentioned or cannot be inferred, use "unspecified".
        - Treat interviews, Q&A, or informational sessions carefully — not everything deserves a Jira ticket.
        - Multiple speakers discussing the same topic should result in ONE consolidated discussion item.

        ONE-SHOT EXAMPLE:

        Input Transcript:
        [00:00:00 - 00:00:10] Speaker A: The login page is failing for some users on mobile.
        [00:00:11 - 00:00:20] Speaker B: Yes, it seems related to the new authentication update.
        [00:00:21 - 00:00:30] Speaker A: We should fix it before the next release.
        [00:00:31 - 00:00:40] Speaker B: I can take that up and aim to finish by Friday.

        Output JSON:
        {
        "discussion_items": [
            {
            "title": "Mobile login failure",
            "description": "Users are experiencing login failures on mobile devices after the authentication update.",
            "category": "bug",
            "jira_recommended": "yes"
            }
        ],
        "next_actions": [
            {
            "action_item": "Fix mobile login issue",
            "description": "Investigate and resolve the login failure affecting mobile users.",
            "deadline": "Friday"
            }
        ]
        }

        CURRENT TASK:
        Analyze the following timestamped transcript:
        ${textFile}

        OUTPUT RULES (STRICT):
        - Return ONLY a valid JSON object.
        - Do NOT include explanations, markdown, or extra text.
        - Do NOT wrap the response in code fences.
        - The response MUST start with '{' and end with '}'.

        JSON SCHEMA (STRICT):
        {
        "discussion_items": [
            {
            "title": string,
            "description": string,
            "category": "task" | "story" | "bug" | "error",
            "jira_recommended": "yes" | "no"
            }
        ],
        "next_actions": [
            {
            "action_item": string,
            "description": string,
            "deadline": string
            }
        ]
        }

        `

    // Execute with retry logic from our conversation history
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const result = await model.generateContent(PROMPT);
        const extraTasks=await model.generateContent(TASKS_PROMPT);
        const text = result.response.text();
        const tasks= extraTasks.response.text();


        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");

        const tasksJsonMatch = tasks.match(/\{[\s\S]*\}/);
        if (!tasksJsonMatch) throw new Error("No JSON found in tasks response");

        const tasksData = JSON.parse(tasksJsonMatch);

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

        const taskAnalysis={
            discussion_items: tasksData.discussion_items,
            next_actions:tasksData.next_actions,
            meetingId: meetingId
        }

        await meetingMetric.create(metrics);

        await meetingTask.create(taskAnalysis);

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


async function generateMom(meetingId,transcript) {
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
  try{
    
  const Meeting=await meeting.findById(meetingId);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: process.env.MODEL_NAME });
  const res = await model.generateContent(`${SYSTEM_PROMPT}\n\nTranscript:\n${transcript}`);
  const clean = res.response.text().replace(/```json|```/g, "").trim();
  const momData= JSON.parse(clean);

  const pdf=await generatePDF(momData,Meeting);


  const uploadedMom=await uploadPdfFile(pdf,Meeting.userId);

  return uploadedMom;

  }catch(err){
    throw new Error(err);
  }
}


  async function performBackgroundAnalysis(meetingId, transcript) {
    console.log(`Starting background analysis for meeting: ${meetingId}`);
    const analyzeTextFile = await analyzeTranscriptFile(meetingId, transcript);

    await meeting.findByIdAndUpdate(meetingId, {
        MomStatus:'processing'
    });
    const Mom = await generateMom(meetingId, transcript);

    
    await meeting.findByIdAndUpdate(meetingId, {
        Mom: Mom.data.fullPath,
        MomStatus:'completed'
    });

    console.log(`Background analysis completed for meeting: ${meetingId}`);
}






module.exports={
    processAudioFile,
    addMeetingMetrics,
    syncGoogleCalenderToDB,
    analyzeTranscriptFile,
    generateMom,
    performBackgroundAnalysis
}