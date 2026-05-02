import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma"
import { sendEmail } from "../lib/email"

export const authRouter = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || "temporary_secret_key"
const OTP_EXPIRES_IN_MS = 10 * 60 * 1000

type PendingAuthChallenge = {
  type: "signup" | "signin"
  email: string
  code: string
  expiresAt: number
  userId?: string
  name?: string
  passwordHash?: string
}

const challenges = new Map<string, PendingAuthChallenge>()

function generateOtpCode(): string {
  return `${Math.floor(100000 + Math.random() * 900000)}`
}

function generateChallengeId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function createToken(user: { id: string; email: string }): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  )
}

function buildOtpEmailHtml(code: string): string {
  return `<div style="font-family: Arial, sans-serif; color: #111;">
    <p>Your Aether verification code is:</p>
    <p style="font-size: 28px; letter-spacing: 4px; font-weight: bold;">${code}</p>
    <p>This code expires in 10 minutes.</p>
  </div>`
}

async function sendOtpEmail(email: string, code: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Aether verification code",
    html: buildOtpEmailHtml(code),
  })
}

// SIGN UP
authRouter.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already used, try another email",
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const code = generateOtpCode()
    const challengeId = generateChallengeId()
    const expiresAt = Date.now() + OTP_EXPIRES_IN_MS

    challenges.set(challengeId, {
      type: "signup",
      email: normalizedEmail,
      code,
      expiresAt,
      name,
      passwordHash: hashedPassword,
    })

    await sendOtpEmail(normalizedEmail, code)

    return res.status(200).json({
      message: "Verification code sent",
      challengeId,
      expiresAt,
    })
  } catch (error) {
    console.error("Signup error:", error)

    return res.status(500).json({
      message: "Server error during signup",
    })
  }
})

authRouter.post("/signup/verify", async (req, res) => {
  try {
    const { challengeId, code } = req.body

    if (!challengeId || !code) {
      return res.status(400).json({
        message: "challengeId and code are required",
      })
    }

    const challenge = challenges.get(challengeId)
    if (!challenge || challenge.type !== "signup") {
      return res.status(400).json({
        message: "Invalid verification challenge",
      })
    }

    if (challenge.expiresAt < Date.now()) {
      challenges.delete(challengeId)
      return res.status(400).json({
        message: "Verification code expired",
      })
    }

    if (challenge.code !== code) {
      return res.status(400).json({
        message: "Invalid verification code",
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: challenge.email },
    })

    if (existingUser) {
      challenges.delete(challengeId)
      return res.status(409).json({
        message: "Email is already used, try another email",
      })
    }

    const user = await prisma.user.create({
      data: {
        name: challenge.name!,
        email: challenge.email,
        password: challenge.passwordHash!,
      },
    })

    challenges.delete(challengeId)
    const token = createToken(user)

    return res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Signup verify error:", error)

    return res.status(500).json({
      message: "Server error during signup verification",
    })
  }
})

// SIGN IN
authRouter.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      })
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      })
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password)

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      })
    }

    const code = generateOtpCode()
    const challengeId = generateChallengeId()
    const expiresAt = Date.now() + OTP_EXPIRES_IN_MS

    challenges.set(challengeId, {
      type: "signin",
      email: normalizedEmail,
      code,
      expiresAt,
      userId: user.id,
    })

    await sendOtpEmail(normalizedEmail, code)

    return res.status(200).json({
      message: "Verification code sent",
      challengeId,
      expiresAt,
    })
  } catch (error) {
    console.error("Signin error:", error)

    return res.status(500).json({
      message: "Server error during signin",
    })
  }
})

authRouter.post("/signin/verify", async (req, res) => {
  try {
    const { challengeId, code } = req.body

    if (!challengeId || !code) {
      return res.status(400).json({
        message: "challengeId and code are required",
      })
    }

    const challenge = challenges.get(challengeId)
    if (!challenge || challenge.type !== "signin") {
      return res.status(400).json({
        message: "Invalid verification challenge",
      })
    }

    if (challenge.expiresAt < Date.now()) {
      challenges.delete(challengeId)
      return res.status(400).json({
        message: "Verification code expired",
      })
    }

    if (challenge.code !== code) {
      return res.status(400).json({
        message: "Invalid verification code",
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
    })

    if (!user) {
      challenges.delete(challengeId)
      return res.status(404).json({
        message: "User not found",
      })
    }

    challenges.delete(challengeId)
    const token = createToken(user)

    return res.status(200).json({
      message: "Signin successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Signin verify error:", error)

    return res.status(500).json({
      message: "Server error during signin verification",
    })
  }
})
