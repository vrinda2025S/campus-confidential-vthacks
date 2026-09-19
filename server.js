require('dotenv').config();

const express = require('express');
const path = require('path');
const connectDB = require('./config/db');
const headlinesRouter = require('./routes/headlines');
const { startPoller } = require('./poller/poll');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/headlines', headlinesRouter);

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Campus Confidential is running at http://localhost:${PORT}`);
    startPoller();
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
