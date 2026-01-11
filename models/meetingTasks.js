const mongoose = require('mongoose');
const {Schema} = mongoose;


const meetingTaskSchema = new Schema({
    discussion_items:{
        type: Array,
    },
    next_actions:{
        type: Array,
    },
    meetingId:{
        type:Schema.Types.ObjectId,
        ref:'meeting',
        required:true
    }
}, { timestamps: true });







const meetingTask = mongoose.model('meetingTask', meetingTaskSchema);



module.exports = meetingTask;