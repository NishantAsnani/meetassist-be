const express=require('express');
const router=express.Router()
const userRoutes=require('./api/user.routes');
const meetingRoutes=require('./api/meeting.routes');

router.use('/user',userRoutes)
router.use('/meeting',meetingRoutes)

router.get('/', (req, res) => {
  res.send('Welcome to the API BROOOO!!!!');
});

module.exports=router