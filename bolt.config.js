module.exports = {
  build: {
    command: "npm run build",
    directory: "dist"
  },
  routes: [
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/index.html" }
  ]
}; 