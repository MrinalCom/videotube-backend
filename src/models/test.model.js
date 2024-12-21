import mongoose, { Mongoose,Schema } from "mongoose";

const TestSchema=new Schema({
    name:{
        type:String,

    },
    roll:{
        type:Number
    }
},{timestamps:true})

export const Test=mongoose.model("Test",TestSchema)