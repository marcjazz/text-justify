import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { justifyText } from "./services/justify_engine";

const app = express();
const PORT = process.env.PORT || 3000;
const getJwtSecret = () => process.env.JWT_SECRET || "super-secret-key";

app.use(express.text());
app.use(express.json());

// In-memory store for rate limiting: { token: { count: number, date: string } }
export const rateLimitStore: Record<string, { count: number; date: string }> =
  {};
const DAILY_WORD_LIMIT = 80000;

/**
 * Middleware: Request Body Validation
 */
const validateRequestBody = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (typeof req.body !== "string" || req.body.trim().length === 0) {
    return res.status(400).send("Request body must be plain text");
  }
  next();
};

/**
 * Middleware: Authentication
 */
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, getJwtSecret(), (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    (req as any).user = user;
    (req as any).token = token;
    next();
  });
};

/**
 * Middleware: Rate Limiting
 */
const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const token = (req as any).token;
  const text = req.body;

  if (typeof text !== "string") {
    return res.status(400).send("Request body must be plain text");
  }

  const wordCount = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const today = new Date().toISOString().split("T")[0];

  if (!rateLimitStore[token] || rateLimitStore[token].date !== today) {
    rateLimitStore[token] = { count: 0, date: today };
  }

  if (rateLimitStore[token].count + wordCount > DAILY_WORD_LIMIT) {
    return res.status(402).send("Payment Required: Rate limit exceeded");
  }

  (req as any).wordCount = wordCount;
  next();
};

/**
 * POST /api/token
 */
app.post("/api/token", (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send("Email is required");
  }

  const token = jwt.sign({ email }, getJwtSecret());
  res.json({ token });
});

/**
 * POST /api/justify
 */
app.post(
  "/api/justify",
  validateRequestBody,
  authenticateToken,
  rateLimiter,
  (req: Request, res: Response) => {
    const text = req.body;
    const token = (req as any).token;
    const wordCount = (req as any).wordCount;

    try {
      const justifiedLines = justifyText(text, 80);
      rateLimitStore[token].count += wordCount;
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
