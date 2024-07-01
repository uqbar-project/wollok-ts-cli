var path = require("node:path");
var fs = require("fs");
var http = require("node:http");

const libsToDownload = [
  {
    libDest: "game",
    libs: [
      {
        filename: "p5.js",
        url: "http://cdnjs.cloudflare.com/ajax/libs/p5.js/1.2.0/p5.js",
      },
      {
        filename: "p5.sound.js",
        url: "http://cdnjs.cloudflare.com/ajax/libs/p5.js/1.5.0/addons/p5.sound.js",
      },
      {
        filename: "socket.io.esm.min.js",
        url: "http://cdn.socket.io/4.4.1/socket.io.esm.min.js",
      },
      {
        filename: "socket.io.esm.min.js.map",
        url: "http://cdn.socket.io/4.4.1/socket.io.esm.min.js.map",
      },
    ],
  },
  {
    libDest: "diagram",
    libs: [
      {
        filename: "socket.io.esm.min.js",
        url: "http://cdn.socket.io/4.4.1/socket.io.esm.min.js",
      },
      {
        filename: "socket.io.esm.min.js.map",
        url: "http://cdn.socket.io/4.4.1/socket.io.esm.min.js.map",
      },
      {
        filename: "cytoscape.min.js",
        url: "http://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js",
      },
    ],
  },
];

for (const { libDest, libs } of libsToDownload) {
  console.log(`Downloading ${libDest} libraries`);

  const libFolder = path.resolve(__dirname, "../public", libDest, "lib");

  if (!fs.existsSync(libFolder)) {
    console.log("Creating lib folder");
    fs.mkdirSync(libFolder, { recursive: true });
  }

  for (const { filename, url } of libs) {
    const dest = path.join(libFolder, filename);
    if (!fs.existsSync(dest)) {
      download(url, dest);
    } else {
      console.log(`Found local version of ${filename}, skipping download`);
    }
  }
}

function download(url, dest) {
  console.log(`Downloading from ${url}`);
  const file = fs.createWriteStream(dest);
  const options = {};
  http
    .get(url, options, (response) => {
      response.pipe(file);
      file.on("finish", () => file.close());
    })
    .on("error", function (err) {
      fs.unlink(dest);
      console.log(err.message);
    });
}
