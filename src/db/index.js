import mongoose from "mongoose";
import dotenv from "dotenv"
dotenv.config()

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}`
    );
    console.log(`mongodb Connected: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.log("Mongodb connection failure: ", error);
    process.exit(1);
    // throw error
  }
};

export default connectDB;
