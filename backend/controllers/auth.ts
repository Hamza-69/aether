import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma"
import { sendEmail } from "../lib/email"
import { requireAuth } from "../lib/auth"
import { uploadProfilePicture, getProfilePictureUrl } from "../lib/storage"

export const authRouter = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || "temporary_secret_key"
const OTP_EXPIRES_IN_MS = 10 * 60 * 1000

type PendingAuthChallenge = {
  type: "signup" | "signin" | "reset-password"
  email: string
  username?: string
  code: string
  expiresAt: number
  userId?: string
  name?: string
  passwordHash?: string
  verified?: boolean
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
    const { name, username, email, password } = req.body
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : ""

    if (!name || !normalizedUsername || !normalizedEmail || !password) {
      return res.status(400).json({
        message: "Name, username, email, and password are required",
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
    const existingUsername = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })

    if (existingUsername) {
      return res.status(409).json({
        message: "Username is already taken",
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const code = generateOtpCode()
    const challengeId = generateChallengeId()
    const expiresAt = Date.now() + OTP_EXPIRES_IN_MS

    challenges.set(challengeId, {
      type: "signup",
      email: normalizedEmail,
      username: normalizedUsername,
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
    if (!challenge.username) {
      challenges.delete(challengeId)
      return res.status(400).json({
        message: "Invalid verification challenge",
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
    const existingUsername = await prisma.user.findUnique({
      where: { username: challenge.username },
    })

    if (existingUsername) {
      challenges.delete(challengeId)
      return res.status(409).json({
        message: "Username is already taken",
      })
    }

    const user = await prisma.user.create({
      data: {
        name: challenge.name!,
        email: challenge.email,
        username: challenge.username!,
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
        username: user.username,
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

    if (!challenge.userId) {
      challenges.delete(challengeId)
      return res.status(400).json({
        message: "Invalid verification challenge",
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
        username: user.username,
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

// FORGOT PASSWORD
authRouter.post("/password/forgot", async (req, res) => {
  try {
    const { email } = req.body
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""

    if (!normalizedEmail) {
      return res.status(400).json({
        message: "Email is required",
      })
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return res.status(404).json({
        message: "No user found with this email",
      })
    }

    const code = generateOtpCode()
    const challengeId = generateChallengeId()
    const expiresAt = Date.now() + OTP_EXPIRES_IN_MS

    challenges.set(challengeId, {
      type: "reset-password",
      email: normalizedEmail,
      code,
      expiresAt,
      userId: user.id,
      verified: false,
    })

    await sendOtpEmail(normalizedEmail, code)

    return res.status(200).json({
      message: "Reset code sent",
      challengeId,
      expiresAt,
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    return res.status(500).json({
      message: "Server error while sending reset code",
    })
  }
})

authRouter.post("/password/verify", async (req, res) => {
  try {
    const { challengeId, code } = req.body

    if (!challengeId || !code) {
      return res.status(400).json({
        message: "challengeId and code are required",
      })
    }

    const challenge = challenges.get(challengeId)
    if (!challenge || challenge.type !== "reset-password") {
      return res.status(400).json({
        message: "Invalid reset challenge",
      })
    }

    if (challenge.expiresAt < Date.now()) {
      challenges.delete(challengeId)
      return res.status(400).json({
        message: "Reset code expired",
      })
    }

    if (challenge.code !== code) {
      return res.status(400).json({
        message: "Invalid reset code",
      })
    }

    challenge.verified = true
    challenges.set(challengeId, challenge)

    return res.status(200).json({
      message: "Code verified",
      challengeId,
      expiresAt: challenge.expiresAt,
    })
  } catch (error) {
    console.error("Reset verify error:", error)
    return res.status(500).json({
      message: "Server error while verifying reset code",
    })
  }
})

authRouter.post("/password/reset", async (req, res) => {
  try {
    const { challengeId, password } = req.body

    if (!challengeId || !password) {
      return res.status(400).json({
        message: "challengeId and password are required",
      })
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      })
    }

    const challenge = challenges.get(challengeId)
    if (!challenge || challenge.type !== "reset-password") {
      return res.status(400).json({
        message: "Invalid reset challenge",
      })
    }

    if (challenge.expiresAt < Date.now()) {
      challenges.delete(challengeId)
      return res.status(400).json({
        message: "Reset code expired",
      })
    }

    if (!challenge.verified || !challenge.userId) {
      return res.status(400).json({
        message: "Reset code must be verified first",
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: challenge.userId },
      data: { password: hashedPassword },
    })

    challenges.delete(challengeId)
    return res.status(200).json({
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return res.status(500).json({
      message: "Server error while resetting password",
    })
  }
})

// GET CURRENT USER
authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        profilePicture: true,
        createdAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    let profilePictureUrl: string | null = null
    if (user.profilePicture) {
      profilePictureUrl = await getProfilePictureUrl(user.profilePicture)
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        profilePictureUrl,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error("Get current user error:", error)
    return res.status(500).json({
      message: "Server error while fetching user",
    })
  }
})

// UPLOAD PROFILE PICTURE
authRouter.put("/me/profile-picture", requireAuth, async (req, res) => {
  try {
    const { image, mimeType } = req.body

    if (!image || !mimeType) {
      return res.status(400).json({
        message: "image (base64) and mimeType are required",
      })
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if (!allowedTypes.includes(mimeType)) {
      return res.status(400).json({
        message: `Unsupported image type. Allowed: ${allowedTypes.join(", ")}`,
      })
    }

    // Limit file size (~5 MB in base64 ≈ ~6.7 MB string)
    const MAX_BASE64_LENGTH = 7 * 1024 * 1024
    if (image.length > MAX_BASE64_LENGTH) {
      return res.status(400).json({
        message: "Image too large. Maximum size is 5 MB",
      })
    }

    const key = await uploadProfilePicture(req.user!.id, image, mimeType)

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { profilePicture: key },
    })

    const profilePictureUrl = await getProfilePictureUrl(key)

    return res.status(200).json({
      message: "Profile picture updated",
      profilePictureUrl,
    })
  } catch (error) {
    console.error("Upload profile picture error:", error)
    return res.status(500).json({
      message: "Server error while uploading profile picture",
    })
  }
})

// DELETE PROFILE PICTURE
authRouter.delete("/me/profile-picture", requireAuth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { profilePicture: null },
    })

    return res.status(200).json({
      message: "Profile picture removed",
    })
  } catch (error) {
    console.error("Delete profile picture error:", error)
    return res.status(500).json({
      message: "Server error while removing profile picture",
    })
  }
})

