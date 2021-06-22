const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const { Schema } = mongoose;
require("dotenv").config();

// Connect to db
mongoose.connect(
  process.env.DB_URI,
  { useNewUrlParser: true, useUnifiedTopology: true },
  console.log("connected to db")
);

app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Create User Model
const userSchema = new Schema({
  username: { type: String, required: true },
  count: Number,
  log: [
    {
      _id: false,
      description: {type: String, required: true},
      duration: {type: Number, required: true},
      date: String
    }
  ]
});
const User = mongoose.model("User", userSchema);

// Add user to database (check if user already exists in mongodb)
// If user already exists return: Username already taken;
app.post("/api/users/", async (req, res) => {
  const username = req.body.username;
  User.find({ username: username }, { __v: 0, log: 0}, (error, result) => {
    if (error) {
      console.log(error);
    }
    if (result.length > 0) {
      res.send("Username already taken");
    } else {
      const newUser = new User({
        username: username
      });
      newUser.save();
      res.json({
       _id: newUser.id,
        username: newUser.username
      });
    }
  });
});

// You can POST to /api/users/:_id/exercises with form data description, duration, and optionally date.
// If no date is supplied, the current date will be used. The response returned will be the user object with the exercise fields added.
app.post("/api/users/:_id/exercises", (req, res) => {
  const id = req.params._id; 
  const description = req.body.description;
  const duration = req.body.duration;
  let date;
  // check date is in correct format
  const dateFormat = /^\d{4}\-\d{2}\-\d{2}$/;
  if(dateFormat.test(req.body.date)) {
    date = new Date(req.body.date).toString().slice(0, 15);
  } else if(!req.body.date){
    date = new Date();
    date = date.toString().slice(0,15);
  } else {
    res.send("Invalid Date Format");
    return;
  };
  const newLog = {
    description,
    duration,
    date
  }
  User.findOneAndUpdate({_id: id}, {$push: {log: newLog}, $inc: { count: 1}}, {new: true}, (error, result) => {
    if(error) {
      console.log(error)
    } else {
      // alter return so only returns needed fields
      const len = result.log.length - 1;
      console.log("result", result);
      res.json({
        _id: result._id,
        username: result.username,
        date: result.log[len].date,
        duration: result.log[len].duration,
        description: result.log[len].description
      });
    }
  })
})

// make a GET request to /api/users to get an array of all users. Each element in the array is an object containing a user's username and _id.
app.get("/api/users/", (req, res) => {
  User.find({}, {__v: 0, log:0}, (error, result) => {
    res.json(result);
    console.log(result);  
  });
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

// You can make a GET request to /api/users/:_id/logs to retrieve a full exercise log of any user.
// The returned response will be the user object with a log array of all the exercises added.
// Each log item has the description, duration, and date properties.
app.get("/api/users/:_id/logs?", (req, res) => {
  const id = req.params._id;
  User.find({_id: id}, {__v: 0}, (error, result) => {
    let responseObject = result;
    if(error){
      console.log(error)
    } else {
      if(req.query.from || req.query.to) {
        let fromDate = new Date(0);
        let toDate = new Date();
        if(req.query.from) {
          fromDate = new Date(req.query.from);
        }
        if(req.query.to) {
          toDate = new Date(req.query.to);
        }
        fromDate = fromDate.getTime();
        toDate = toDate.getTime();
        responseObject[0].log = responseObject[0].log.filter((sesh) => {
          let seshDate = new Date(sesh.date).getTime();
          console.log("seshDate", seshDate);
          return seshDate >= fromDate && seshDate <= toDate;
        })
      }
      if(req.query.limit) {
        responseObject[0].log = responseObject[0].log.slice(0, req.query.limit);
      }
      
      res.json({
        _id: responseObject[0]._id,
        username: responseObject[0].username,
        count: responseObject[0].count,
        log: responseObject[0].log
      });
    }
  })
})