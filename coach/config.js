// StrokeWise coach site – configuration. Both values are public (the same ones the app ships in its own config.js):
// the Web API key only identifies the Firebase project; database.rules.json in the app repo is what protects the data.
window.COACH_CONFIG = {
  firebaseKey: 'AIzaSyAsC2Mu2MIv_IEwlnEKkyJzHxG9bQZMiAI',
  db: 'https://pin-high-live-default-rtdb.firebaseio.com',
  inviteBase: 'https://app.strokewise.app/?team=' // athletes join with this link (or by typing the code in the app)
};
