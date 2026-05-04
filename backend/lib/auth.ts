import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { prisma } from "./prisma"

const JWT_SECRET = process.env.JWT_SECRET || "temporary_secret_key"

export type AuthUser = {
  id: string
  email: string
  name: string
  username: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/**
 * Express middleware that verifies the JWT from the Authorization header
 * and attaches the full user object to `req.user`.
 *
 * Returns 401 if the token is missing, invalid, expired, or the user
 * no longer exists in the database.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" })
    return
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string
      email: string
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, username: true },
    })

    if (!user) {
      res.status(401).json({ error: "User not found" })
      return
    }

    req.user = user
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" })
      return
    }
    res.status(401).json({ error: "Invalid token" })
    return
  }
}
