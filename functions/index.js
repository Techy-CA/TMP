const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.setAdminByEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const requester = await admin.firestore().collection("users").doc(context.auth.uid).get();
  const requesterData = requester.data();

  if (!requesterData || requesterData.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  if (!data.email) {
    throw new functions.https.HttpsError("invalid-argument", "Email required");
  }

  const userRecord = await admin.auth().getUserByEmail(data.email);
  await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

  await admin.firestore().collection("users").doc(userRecord.uid).set({
    role: "admin",
    email: data.email
  }, { merge: true });

  return { success: true };
});

exports.bootstrapDemoUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const requester = await admin.firestore().collection("users").doc(context.auth.uid).get();
  const requesterData = requester.data();

  if (!requesterData || requesterData.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const email = "cs@gmail.com";
  const password = "123456";

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (e) {
    user = await admin.auth().createUser({
      email,
      password,
      displayName: "CS Demo"
    });
  }

  await admin.auth().setCustomUserClaims(user.uid, { admin: true });

  await admin.firestore().collection("users").doc(user.uid).set({
    fullName: "CS Demo",
    email,
    role: "admin",
    phone: "",
    dob: "",
    age: 0,
    aadhaar: "",
    pan: "",
    city: "",
    state: "",
    pinCode: "",
    fullAddress: ""
  }, { merge: true });

  return { success: true, email, password };
});