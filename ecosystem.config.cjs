const cwd = __dirname;

module.exports = {
  apps: [
    {
      name: "surtiswaad-manager-build",
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
      name: "surtiswaad-manager",
      script: "npx",
      args: "vite preview --port 3000 --host",
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
