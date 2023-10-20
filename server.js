const express = require("express");
const bodyParser = require("body-parser");
const redis = require("redis");
const mongoose = require("mongoose");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const Server = require("socket.io");
const server = http.createServer(app);
const secretKey1 = "auth-token";

const PORT = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(cors());

mongoose.connect("mongodb://localhost:27017/agentDatabase", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// making connection with angular
const io = Server(server, {
  cors: {
    origin: ["http://localhost:4200"],
  },
});

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("agentSignupData", userSchema);

app.use(cors());

io.on("connection", async (socket) => {
  console.log("a user is connected");
  // Handle user messages and forwarding to agents.
  socket.on("userMessage", (message) => {
    console.log("received user messsages", message);
    // Broadcast the message to all connected agents.
    socket.broadcast.emit("agentMessage", message);
  });

  socket.on("agentLogin", async (credentials) => {
    try {
      const agent = await User.findOne({
        username: credentials.username,
        password: credentials.password,
      });

      if (agent) {
        socket.join("agents");

        socket.emit("agentLoginSuccess");
        console.log("agent join the room");
      } else {
        socket.emit("agentLoginFail");
      }
    } catch (err) {
      console.error("Error while querying the database:", err);
      socket.emit("agentLoginFail");
    }
  });

  socket.on("agentMessage", async (message) => {
    console.log("Received message from client:", message);
    // Broadcast the message to all connected users.
    socket.broadcast.emit("userMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});
// set port
server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
//check the server is running or not
app.get("/", function (req, res) {
  res.send("OK");
});

app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: "Email is already taken" });
      return;
    }
    const newUser = new User({ username, email, password });
    await newUser.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ error: "An error occurred" });
  }
});

// login

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        email: user.email,
      },
      secretKey1,
      {
        expiresIn: "1h",
      }
    );

    // Send the token and user information back to the client
    res.json({
      token,
      userId: user._id,
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ error: "An error occurred" });
  }
});
