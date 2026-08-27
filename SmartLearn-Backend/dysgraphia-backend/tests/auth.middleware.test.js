import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createMemoryDysgraphiaRepository } from "../src/modules/dysgraphia/repository";

function buildAuthClient() {
  return {
    verifyIdToken: vi.fn(async (token) => {
      if (token === "valid-token") {
        return { uid: "user-1", email: "student@example.com" };
      }

      throw new Error("invalid token");
    }),
  };
}

describe("auth middleware", () => {
  it("rejects requests without a bearer token", async () => {
    const repository = createMemoryDysgraphiaRepository();
    repository.seedUserProfile("user-1", { role: "student" });
    const app = createApp({
      authClient: buildAuthClient(),
      repository,
      predictor: {
        predictSingleCharacter: vi.fn(),
        predictWord: vi.fn(),
      },
    });

    const response = await request(app).get("/api/dysgraphia/overview");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("accepts valid tokens and loads the role from userProfiles", async () => {
    const repository = createMemoryDysgraphiaRepository();
    repository.seedUserProfile("user-1", { role: "student" });
    const app = createApp({
      authClient: buildAuthClient(),
      repository,
      predictor: {
        predictSingleCharacter: vi.fn(),
        predictWord: vi.fn(),
      },
    });

    const response = await request(app)
      .get("/api/dysgraphia/overview")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.stats.totalStars).toBe(0);
  });
});