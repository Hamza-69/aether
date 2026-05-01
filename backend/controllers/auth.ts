import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma"

export const authRouter = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || "temporary_secret_key"

// SIGN UP
authRouter.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already used",
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    })

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    )

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
    console.error("Signup error:", error)

    return res.status(500).json({
      message: "Server error during signup",
    })
  }
})

// SIGN IN
authRouter.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      })
    }

    const user = await prisma.user.findUnique({
      where: { email },
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

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    )

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
    console.error("Signin error:", error)

    return res.status(500).json({
      message: "Server error during signin",
    })
  }
})