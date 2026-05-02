// PM2 process manager config for TiVa on AWS EC2
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 stop all
//   pm2 logs
//   pm2 save && pm2 startup   (to auto-start on reboot)

require("dotenv").config({ path: require("path").join(__dirname, ".env") });

module.exports = {
  apps: [
    {
      name: "tiva-api",
      cwd: "./artifacts/api-server",
      script: "../../node_modules/.bin/node",
      args: "--enable-source-maps ./dist/index.mjs",
      interpreter: "none",
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: process.env.PORT || "8080",
        DATABASE_URL: process.env.DATABASE_URL,
        AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "tiva-web",
      cwd: "./artifacts/student-tutor",
      script: "../../node_modules/.bin/expo",
      args: "start --web --port 3000",
      interpreter: "none",
      env: {
        EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        NODE_ENV: process.env.NODE_ENV || "production",
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
