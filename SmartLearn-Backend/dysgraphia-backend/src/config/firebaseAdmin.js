const fs = require("fs");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const env = require("./env");

function getFirebaseServiceAccountInfo() {
  const serviceAccount = resolveServiceAccount();
  return {
    serviceAccount,
    projectId: env.firebaseProjectId || serviceAccount?.project_id || "",
    path: env.firebaseServiceAccountPath,
  };
}

function resolveServiceAccount() {
  try {
    if (env.firebaseServiceAccountJson) {
      return JSON.parse(env.firebaseServiceAccountJson);
    }

    if (env.firebaseServiceAccountPath) {
      if (!fs.existsSync(env.firebaseServiceAccountPath)) {
        throw new Error(`Firebase service account file not found at ${env.firebaseServiceAccountPath}`);
      }

      const raw = fs.readFileSync(env.firebaseServiceAccountPath, "utf8");
      return JSON.parse(raw);
    }

    if (env.firebaseClientEmail && env.firebasePrivateKey && env.firebaseProjectId) {
      return {
        project_id: env.firebaseProjectId,
        client_email: env.firebaseClientEmail,
        private_key: env.firebasePrivateKey,
      };
    }

    throw new Error(
      "Firebase service account credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Firebase service account credentials are invalid JSON: ${error.message}`);
    }

    throw error;
  }
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    console.log("[FIREBASE] using existing Firebase Admin app instance");
    return getApps()[0];
  }

  const serviceAccount = resolveServiceAccount();
  const resolvedProjectId = env.firebaseProjectId || serviceAccount?.project_id || "";

  if (!resolvedProjectId) {
    throw new Error("Firebase project ID is required for Firebase Admin initialization.");
  }

  const credential = cert(serviceAccount);

  console.log("[FIREBASE] initializing Firebase Admin SDK");
  console.log("[FIREBASE] service account credentials loaded successfully");
  console.log("[FIREBASE] configured project ID:", env.firebaseProjectId || "(empty)");
  console.log("[FIREBASE] service account project ID:", serviceAccount?.project_id || "(empty)");
  console.log("[FIREBASE] resolved project ID:", resolvedProjectId);
  console.log("[FIREBASE] credential source:", "service-account");
  console.log("[FIREBASE] service account file path:", env.firebaseServiceAccountPath || "(not set)");

  return initializeApp({
    credential,
    projectId: resolvedProjectId,
  });
}

function getFirebaseAdminServices() {
  const app = getFirebaseAdminApp();
  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}

module.exports = {
  getFirebaseAdminServices,
  getFirebaseServiceAccountInfo,
};