const mongoose = require('mongoose');
const {Schema} = mongoose;


const meetingMetricSchema = new Schema({
    engagement_score:{
        type: Number,
        required: true
    },
    speaker_balance: {
        type: String,
        enum:['balanced','skewed','dominated'],
        default:'balanced'
    },
    meetingId:{
        type:Schema.Types.ObjectId,
        ref:'meeting',
        required:true
    },
    silence_ratio: {
        type: String,
        enum:['low','medium','high'],
        default:'medium'
    },
    off_topic_score:{
        type:Number
    },
    conflict_level:{
        type:String,
        enum:['low','medium','high','none'],
        default:'medium'
    },
    time_utilization:{
        type:String,
        enum:['poor','fair','good','excellent'],
        default:'fair'
    },
    meeting_resolution:{
        type:String,
        enum:['success', 'partial', 'failed', 'inconclusive'],
        default:'partial'
    },
    meeting_roi:{
        type:String,
        enum:['poor','fair','good','excellent'],
        default:'fair'
    },
}, { timestamps: true });







const meetingMetric = mongoose.model('meetingMetric', meetingMetricSchema);



module.exports = meetingMetric;
