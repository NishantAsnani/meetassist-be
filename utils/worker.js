require('dotenv').config();
const { Worker } = require('bullmq');
const { connection } = require('./queue');
const meetingServices = require('../services/meeting.service');
const { getSignedUrl } = require('./helper');
const dbconnection = require('../db');
const meeting = require('../models/meetings');


// Connect to database before processing any jobs
(async () => {
  await dbconnection();
  console.log('🔗 Worker connected to database');
})();

const worker = new Worker('submission-queue', async (job) => {
    const {
        meetingId,
        userId,
        fileBuffer,
        originalname,
        mimetype,
        audioFilePath,
    } = job.data;

    console.log(`📋 [Job ${job.id}] Starting processing for meeting: ${meetingId}`);

    try {
        // ── Step 1: Set status to 'processing' ──
        await meeting.findByIdAndUpdate(meetingId, {
            MomStatus: 'processing'
        });

        // ── Step 2: Reconstruct file buffer from serialized array ──
        const reconstructedFile = {
            buffer: Buffer.from(fileBuffer),
            originalname,
            mimetype,
        };

        // ── Step 3: Transcribe audio via AssemblyAI ──
        console.log(`🎙️ [Job ${job.id}] Transcribing audio...`);
        const processFile = await meetingServices.processAudioFile(reconstructedFile, userId);

        if (processFile.status !== 'success') {
            throw new Error('Audio transcription failed');
        }

        console.log(`✅ [Job ${job.id}] Transcription complete`);
        await job.updateProgress({ stage: "transcription-completed", meetingId, userId });
        

        // ── Step 4: Update meeting with text file path ──
        await meeting.findByIdAndUpdate(meetingId, {
            textFilePath: processFile.data.textFile.fullPath
        });
        await job.updateProgress({ stage: "analyzing-metrics-completed", meetingId, userId });


        // ── Step 5: Run background analysis (metrics + tasks + MoM generation) ──
        console.log(`📊 [Job ${job.id}] Running analysis & generating MoM...`);
        await meetingServices.performBackgroundAnalysis(meetingId, processFile.data.transcript);

        console.log(`🎉 [Job ${job.id}] All processing completed for meeting: ${meetingId}`);

    } catch (err) {
        console.error(`❌ [Job ${job.id}] Processing failed for meeting ${meetingId}:`, err.message);

        // Mark meeting as failed so frontend can show error state
        try {
            await meeting.findByIdAndUpdate(meetingId, {
                MomStatus: 'failed'
            });
        } catch (updateErr) {
            console.error(`❌ [Job ${job.id}] Failed to update MomStatus to 'failed':`, updateErr.message);
        }

        // Re-throw so BullMQ marks the job as failed
        throw err;
    }
}, {
    connection,
    concurrency: 2, // Process up to 2 jobs at a time
});

// ── Worker-level event listeners ──
worker.on('completed', (job) => {
    console.log(`✅ [Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ [Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
    console.error('❌ [Worker] Worker error:', err.message);
});

console.log('🚀 Worker started and listening for jobs...');