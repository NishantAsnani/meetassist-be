const {formatTime}=require('../utils/helper');
const { AssemblyAI } = require('assemblyai');
const {uploadTextFile}=require('../utils/helper');
const meetingMetric=require('../models/meetingMetrics');
const meeting=require('../models/meetings');

async function processAudioFile(file,userId) {
    try {
        const client = new AssemblyAI({
    apiKey:process.env.ASSEMBLY_AI_KEY
});
    const startTime = Date.now(); 
    console.log("FILE IN SERVICE: ",file);
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
        data: texFile.data,
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

module.exports={
    processAudioFile,
    addMeetingMetrics
}