import chokidar from "chokidar";

const watcher = chokidar.watch("./src", {
  usePolling: true,
  interval: 300,
  ignoreInitial: true,
});

watcher.on("change", (path) => console.log("CHANGE DETECTED:", path));
watcher.on("add",    (path) => console.log("FILE ADDED:", path));
watcher.on("error",  (err)  => console.error("WATCHER ERROR:", err));
watcher.on("ready",  ()     => console.log("Watcher ready. Now edit a file and save..."));
