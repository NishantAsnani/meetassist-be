const socket=require('socket.io');
let io;

const initializeSocket=(server)=>{
io=socket(server,{
  cors:{
    origin:"http://localhost:5173"
  }
})

io.on("connection",(socket)=>{
  console.log("Connected");
   socket.on("register-user",(userId) => {

      socket.join(userId);
      console.log(`${socket.id} joined ${userId}`);

    }
  );
})

}

const getIo = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};


module.exports={initializeSocket,getIo}