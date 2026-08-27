const { AppError } = require("../utils/appError");
const env = require("../config/env");

function formatErrorDetails(error) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: error.stack,
    details: error.errorInfo || error.errors || null,
  };
}

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

function resolveRole(decodedToken, profileRole) {
  if (decodedToken?.role) {
    return decodedToken.role;
  }

  if (decodedToken?.roles && Array.isArray(decodedToken.roles) && decodedToken.roles.length > 0) {
    return decodedToken.roles[0];
  }

  return profileRole || "student";
}

function createAuthMiddleware({ authClient, repository, logger }) {
  return async function authMiddleware(req, res, next) {
    console.log(`[AUTH] middleware hit: ${req.method} ${req.originalUrl}`);
    console.log(`[AUTH] Authorization header present: ${Boolean(req.headers.authorization)}`);

    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      console.log("[AUTH] bearer token missing or malformed");
      next(new AppError(401, "UNAUTHENTICATED", "Missing or invalid Authorization header."));
      return;
    }

    console.log(`[AUTH] bearer token preview: ${token.slice(0, 30)}...`);
    console.log("[AUTH] authClient present:", Boolean(authClient));
    console.log("[AUTH] configured Firebase project ID:", env.firebaseProjectId || "(empty)");

    try {
      console.log("[AUTH] calling verifyIdToken()");
      const decodedToken = await authClient.verifyIdToken(token);
      console.log("[AUTH] decoded token payload:", JSON.stringify(decodedToken, null, 2));
      console.log("[AUTH] token audience:", decodedToken?.aud || "(empty)");
      console.log("[AUTH] token issuer:", decodedToken?.iss || "(empty)");
      console.log("[AUTH] token firebase sign-in provider:", decodedToken?.firebase?.sign_in_provider || "(empty)");

      if (decodedToken?.aud && env.firebaseProjectId && decodedToken.aud !== env.firebaseProjectId) {
        console.warn("[AUTH] token audience does not match configured Firebase project ID");
      }

      const profileRole = repository?.getUserRole ? await repository.getUserRole(decodedToken.uid) : null;

      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || "",
        role: resolveRole(decodedToken, profileRole),
        claims: decodedToken,
      };

      next();
    } catch (error) {
      console.error("[AUTH] verifyIdToken failed");
      console.error("[AUTH] full verifyIdToken error:", JSON.stringify(formatErrorDetails(error), null, 2));
      console.error("[AUTH] raw firebase error object:", error);

      next(new AppError(401, "UNAUTHENTICATED", error?.message || "Firebase authentication failed.", { cause: error }));
    }
  };
}

module.exports = {
  createAuthMiddleware,
};