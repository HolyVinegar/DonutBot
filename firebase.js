const admin = require('firebase-admin');

const serviceAccount = {
  "type": "service_account",
  "project_id": "c-37-project-9153a",
  "private_key_id": "53948edf10611c5eda5dda2bb58cd9ac83d60998",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDCwEeKvVTVbWBC\nvgflUPS5yjSTaLAEfCjoGcHxyIkQvNWBLolBTUa+F+3a9KduCtil+2Enyybq961H\nXNl+CV+OmzB9cpPzJshNaS3Q7nwYGYiEcOzt7c2MGf1Y/a6lS+iBiNX9Tx+hmiOP\nSH9fThqdNVLvLUx91xzJs0eV+XDkFGcctV77xk5GuwdvGfkABVajD5TnR64xmEAk\nOnYmu/E5nj5TaNDswSJrh06diiFsEyOipTLIlowTy0ujicHfmnlJdw/sgAhe2b+a\nm9qVb52jCAuOaNsDamJODbIAxTkIQJN9+K86WJZtFtf587ehD82QYX9U6Lp97JIU\nqF9dU6VtAgMBAAECggEABiI2B8I9NPh3jATeA8tpSuawpoC7f5nOVE0L8sGRndhD\nigiq9msNSWauP5gSSHMtty5GR5F+5spNvru1P+J0sKR4L9ogUlTw3MRtVsOWXxle\nMtdb8Bfb5uxZMmissGI0AToeHzt3puzz7wr4RkpdFlzggU3Ibip6T0aG3ALZ0biC\nmqDEkcUbmYx3WQYwAWKwReK+gxCx+cp/7kCvVJU8iFONdWiYURAH08z8smzLDUFL\nnzsCt9qsAu+OtYfChq7G+/OiYz+/fK6iQ6Fk06vODcDRHDa9pRk7yPBjaNpRGcli\ntuSjreXlZNVm9VAa77Z8JpAcnVlWCCANnryR2U5EcwKBgQD9g6Y1CmFGJ7b8mgs1\nEznTTsmAxTfoEa9aI0h9Gwd7ZlKl2C0IL0k9qMbtfsd51+qeL2EPZVq0Zpiy7+3Q\ncnaXkWlkdCZyJFukFjNZM5LeICsWN1FVopietITzGvglZ5AoNOgGk/i8ZOZwtvkg\nw+AY0P8fib1UoHRQ4WJRMnXrtwKBgQDEqSCyr8M18oR3lAure4+kP8NOHxg/OIFq\nOqpRwzG0PQtJsZzTKBIOAv5m4W4tdahmM3//EIfKQmt4qk1Y8U5gJ0ytdcyngyX+\nP+Pz5Snmd1Fvtx/v2TYUqAhcg7rZutV58rCSyjxBWCZLX4zf3hB1mmsYluX7/I3y\nWGnxDei/+wKBgFuTxOSAHWd0TTuugcHocgkM+ulTVMC2MrvC5xqaOveunMhf8NR2\nEGT/pOyB0ZkIEC6YOt2O5VcpgJuS5DtaPdC+rG2nL4Qn8hqyElZ0tOccg7QAw5bF\np5Ac8bHH2j/Yy1Ba3D4UEdQsNrocvp3BZCBSzvYbkZMSazIUWKmwKry9AoGBAJli\nPAGB+qRZ6Z2GV2/BKHB31vFYaUXt4WokJXEt59dnASXSJLnAeAx7o0ZErvU/3j8Q\nDdW3Y+GJ2l67nSYw1utB25ky1pMURA7AcB9q7jo1d8vFLWCZrod/4z2c9KAbC6NY\neQWUPFjO0tdYx/xXK8k9zifYkbnu6htJgB+ltJH/AoGAIoJAhUyp7briOLR7WC1P\nJ8jMlhCCNEQ3ASyIy283jlNxHokpbIxCqO5wUScoJjQGNA7YzVN2Ejsh+6geTKbl\naO0DdU02eHh2eq9342oPn166nYhmDKMXgwihtehJkElOU7WqVJPOoQDAGIyPkhKS\nfaJGAUu8qlB4hnQxjqJOSUc=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-j2dyo@c-37-project-9153a.iam.gserviceaccount.com",
  "client_id": "106260275758465669975",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-j2dyo%40c-37-project-9153a.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://your-project-id.firebaseio.com"
});

const db = admin.database();

async function getData(path) {
  const snapshot = await db.ref(path).once('value');
  return snapshot.val() || {};
}

async function setData(path, value) {
  await db.ref(path).set(value);
}

async function updateData(path, value) {
  await db.ref(path).update(value);
}

module.exports = { db, getData, setData, updateData };