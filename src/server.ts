import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { justifyText } from "@/services/justify-engine";
import { IRateLimitStore } from "@rate-limiter/rate-limit-store.interface";
import { InMemoryRateLimiterStore } from "@rate-limiter/impl/in-memory-rate-limit-store";
import { RedisRateLimiterStore } from "@rate-limiter/impl/redis-rate-limit-store";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Text Justification API",
      version: "1.0.0",
      description: "A simple API to justify text and handle rate limiting.",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/server.ts"], // files containing annotations
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(morgan("dev"));
app.use(express.json());
app.use(express.text());

// Initialize store based on environment
const REDIS_URL = process.env.REDIS_URL;
export const rateLimitStore: IRateLimitStore = REDIS_URL 
    ? new RedisRateLimiterStore(REDIS_URL) 
    : new InMemoryRateLimiterStore();

const DAILY_WORD_LIMIT = 80000;

/**
 * Middleware: Authentication
 */
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    (req as any).user = user;
    (req as any).token = token;
    next();
  });
};

/**
 * Middleware: Rate Limiting
 */
const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const text = req.body;

  if (typeof text !== "string") {
    return res.status(400).send("Request body must be plain text");
  }

  const wordCount = text.trim().split(/\s+/).length;
  const today = new Date().toISOString().split("T")[0];

  try {
    const currentWordCount = await rateLimitStore.getWordCount(user.email, today);

    if (currentWordCount + wordCount > DAILY_WORD_LIMIT) {
      return res.status(402).send("Payment Required: Rate limit exceeded");
    }

    await rateLimitStore.incrementWordCount(user.email, wordCount, today);
    next();
  } catch (error) {
    console.error("Rate Limiter Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

/**
 * @openapi
 * /api/token:
 *   post:
 *     summary: Generate a JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: JWT token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 */
app.post("/api/token", (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send("Email is required");
  }

  const token = jwt.sign({ email }, JWT_SECRET);
  res.json({ token });
});

/**
 * @openapi
 * /api/justify:
 *   post:
 *     summary: Justify text
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *             example: "This is a long text that needs to be justified to 80 characters per line."
 *     responses:
 *       200:
 *         description: Justified text
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       400:
 *         description: Bad Request (Invalid input)
 *       401:
 *         description: Unauthorized
 *       402:
 *         description: Payment Required (Rate limit exceeded)
 */
app.post(
  "/api/justify",
  authenticateToken,
  rateLimiter,
  (req: Request, res: Response) => {
    const text = req.body;
    try {
      const justifiedLines = justifyText(text, 80);
      res.type("text/plain").send(justifiedLines.join("\n"));
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }
);

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
export { server };