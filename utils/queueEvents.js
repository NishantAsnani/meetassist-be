const { QueueEvents } = require("bullmq");
const { connection } = require('./queue');
const queueEvents = new QueueEvents("submission-queue", { connection });
const { submissionQueue } = require('./queue');
const { getIo } = require('./socket');

queueEvents.on("completed", async ({ jobId }) => {
    const job = await submissionQueue.getJob(jobId);

    getIo().to(job.data.userId).emit(
        "mom-completed",
        { meetingId: job.data.meetingId }
    );
});

queueEvents.on("progress", async ({ jobId, data }) => {

    const { stage, meetingId, userId } = data;

    if (stage === "transcription-completed") {
        getIo().to(userId).emit("transcription-completed", { meetingId });
    }

    if (stage === "analyzing-metrics-completed") {
        getIo().to(userId).emit("analyzing-metrics-completed", { meetingId });
    }
});