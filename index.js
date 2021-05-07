if (process.env.NODE_ENV !== "production") require("dotenv").config();

// Express.js
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");

// Express Sessions
const session = require("express-session");
app.use(
  session({
    secret: "cowsgomoo",
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Spotify Web Node
const SpotifyWebApi = require("spotify-web-api-node");
const scopes = ["playlist-read-private"];
const spotifySessions = {};

app.get("/", async (req, res) => {
  if (!spotifySessions[req.session.id]) return res.redirect("/login");

  const playlistsRes = await spotifySessions[req.session.id].getUserPlaylists(
    req.session.spotifyId,
    {
      limit: 50,
    }
  );
  const playlists = playlistsRes.body.items;
  const userPlaylists = {};

  // for (let i = 0; i < 20; i++) {
  //   userPlaylists[`test-playlist-${i}`] = [];

  //   for (let j = 0; j < Math.floor(Math.random() * 100); j++) {
  //     userPlaylists[`test-playlist-${i}`].push({
  //       name: `test song ${j}`,
  //       artist: `test artist ${j}`,
  //       album: `test album ${j}`,
  //     });
  //   }
  // }

  for (const playlist of playlists) {
    let numTracks = playlist.tracks.total;
    userPlaylists[playlist.name] = [];

    while (numTracks > 0) {
      const playlistRes = await spotifySessions[req.session.id]
        .getPlaylistTracks(playlist.id, {
          limit: Math.min(100, numTracks),
          offset: playlist.tracks.total - numTracks,
        })
        .then((data) => data.body.items);

      for (const track of playlistRes) {
        await userPlaylists[playlist.name].push({
          name: track.track.name,
          artist: track.track.artists[0].name,
          album: track.track.album.name,
        });
      }
      numTracks -= playlistRes.length;
    }
  }

  res.render("index", {
    playlists: userPlaylists,
  });
});

app.get("/login", (req, res) => {
  spotifySessions[req.session.id] = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_CALLBACK_URL,
  });
  const spotifyAuthorizeUrl = spotifySessions[
    req.session.id
  ].createAuthorizeURL(scopes);

  res.render("login", {
    spotifyAuthorizeUrl: spotifyAuthorizeUrl,
  });
});

app.get("/callback", async (req, res) => {
  if (!spotifySessions[req.session.id]) return res.redirect("/login");

  const code = req.query.code;

  // Set code
  await spotifySessions[req.session.id]
    .authorizationCodeGrant(code)
    .then((data) => {
      spotifySessions[req.session.id].setAccessToken(data.body["access_token"]);
      spotifySessions[req.session.id].setRefreshToken(
        data.body["refresh_token"]
      );
    });

  // Get current user
  req.session.spotifyId = await spotifySessions[req.session.id]
    .getMe()
    .then((data) => data.body.id);

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
