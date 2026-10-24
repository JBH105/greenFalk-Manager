const cwd = __dirname;

module.exports = {
  apps: [
    {
      name: "greenFalk-Manager-build",
      script: "npm",
      args: "run build",
      cwd,
      exec_mode: "fork",
      instances: 1,

      // Build should run only once.
      autorestart: false,

      watch: false,

      env: {
        NODE_ENV: "production",
      },
    },

    {
      name: "greenFalk-Manager",
      script: "npx",
      args: "vite preview --port 7002 --host",
      cwd,
      exec_mode: "fork",
      instances: 1,

      autorestart: true,
      watch: false,

      max_memory_restart: "1G",

      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
