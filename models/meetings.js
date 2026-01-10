const mongoose = require('mongoose');
const {Schema} = mongoose;


const meetingSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    startedAt: {
        type: Date,
        required: true,
    },
    userId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    googleCalendarId:{
        type:String,
    },
    googleEventId:{
        type:String,
    },
    endedAt: {
        type: Date,
        required: true
    },
    short_summary:{
        type:String
    },
    long_summary:{
        type:String
    },
    improvements:{
        type:[String]
    },
    Mom:{
        type:String
    },
    audioFilePath:{
        type:String,
    },
    textFilePath:{
        type:String,
    },
    lastSyncedAt:{
        type:Date,
    }
    
}, { timestamps: true });







const meeting = mongoose.model('meeting', meetingSchema);



module.exports = meeting;
