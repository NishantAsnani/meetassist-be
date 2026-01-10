const express=require('express');
const router=express.Router()
const meetingControllers=require('../../controllers/meeting.controllers')
const auth=require('../../middleware/auth')
const {upload,uploadAudioFiletoSupaBase}=require('../../utils/helper');

// router.get('/',auth,meetingControllers.getAllMeetings)

// router.get('/:id',auth,meetingControllers.getMeetingById)

// router.post('/login',authControllers.Login)

router.post('/addMetrics',auth,meetingControllers.addMeetingMetrics)

router.post('/processFile',auth,upload.single('file'),meetingControllers.uploadAndProcessFile)

router.get('/',auth,meetingControllers.getMeetings)
// router.patch('/:id',auth,meetingControllers.editMeeting)

// router.delete('/:id',auth,meetingControllers.deleteMeeting)    



module.exports=router
