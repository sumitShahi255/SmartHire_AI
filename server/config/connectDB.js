import mongoose from "mongoose";

const connectDB = async () => {
      try{
            await mongoose.connect(process.env.MONGODB_URL);
            console.log("Database Connnected Successful");
      }catch (err){
            console.log(`Database error ${err}`);
      }
}

export default connectDB;