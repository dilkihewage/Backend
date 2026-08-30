const path = require("path");
const { spawn } = require("child_process");

const env = require("./config/env");
const { createApp } = require("./app");

// START PYTHON MODEL SERVER
const modelAppPath = path.join(
  __dirname,
  "models",
  "app.py"
);

console.log("Starting Sinhala handwriting model...");

const configuredPython = process.env.PYTHON_EXECUTABLE;
const pythonCommand = configuredPython
  ? path.isAbsolute(configuredPython)
    ? configuredPython
    : path.resolve(__dirname, "..", configuredPython)
  : process.platform === "win32"
    ? path.resolve(__dirname, "..", "..", "..", "venv", "Scripts", "python.exe")
    : "python3";

const pythonProcess = spawn(
  pythonCommand,
  [
    "-m",
    "uvicorn",
    "app:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8001",
  ],
  {
    cwd: path.dirname(modelAppPath),
    stdio: ["ignore", "pipe", "pipe"],
  }
);


// PYTHON MODEL LOGS
pythonProcess.stdout.on("data", (data) => {
  console.log(`[PYTHON MODEL] ${data.toString().trim()}`);
});

pythonProcess.stderr.on("data", (data) => {
  console.error(`[PYTHON MODEL] ${data.toString().trim()}`);
});

pythonProcess.on("error", (error) => {
  console.error(
    "Failed to start Python model:",
    error.message
  );
});

pythonProcess.on("close", (code) => {
  console.log(
    `Python model process stopped with code ${code}`
  );
});

// START NODE BACKEND
const app = createApp();

const server = app.listen(
  env.port,
  env.host,
  () => {
    console.log(
      `Dysgraphia backend listening on http://${env.host}:${env.port}`
    );

    console.log(
      "Sinhala model expected at http://127.0.0.1:8001/predict"
    );
  }
);


// CLEAN SHUTDOWN
function shutdown() {

  console.log("Shutting down...");

  server.close(() => {

    if (pythonProcess) {
      pythonProcess.kill();
    }

    process.exit(0);

  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);


module.exports = app;
