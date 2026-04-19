import { Router } from "express"
import { Sandbox } from "e2b"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { CreateProjectBodySchema } from "../models"
import { getStateDownloadUrl } from "../lib/storage"

export const projectsRouter = Router()

const toKebabCase = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)

const stringifyEnv = (env: Record<string, string>) => {
  const lines = Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  return `${lines.join("\n")}\n`
}

projectsRouter.get("/", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
    })
    res.status(200).json({ projects })
  } catch (error) {
    console.error("[projectsRouter.GET] Failed to list projects:", error)
    res.status(500).json({ error: "Failed to list projects" })
  }
})

projectsRouter.post("/", async (req, res) => {
  console.log(`[projectsRouter.POST] Received request to create project`)

  const parsed = CreateProjectBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" })
    return
  }

  const { prompt, name } = parsed.data
  console.log(`[projectsRouter.POST] name=${name || "(none)"}, prompt length: ${prompt.length}`)

  const projectName = name?.trim() || toKebabCase(prompt)
  console.log(`[projectsRouter.POST] Resolved project name: "${projectName}"`)

  try {
    const project = await prisma.project.create({
      data: { name: projectName },
    })
    console.log(`[projectsRouter.POST] Created project: ${project.id}`)

    await prisma.message.create({
      data: {
        projectId: project.id,
        content: prompt,
        role: "USER",
        type: "SUCCESS",
      },
    })
    console.log(`[projectsRouter.POST] Created user message for project: ${project.id}`)

    await inngest.send({
      name: "code-agent/run",
      data: {
        value: prompt,
        projectId: project.id,
      },
    })
    console.log(`[projectsRouter.POST] Fired code-agent/run event for project: ${project.id}`)

    res.status(201).json({ project })
  } catch (error) {
    console.error("[projectsRouter.POST] Failed to create project:", error)
    res.status(500).json({ error: "Failed to create project" })
  }
})

projectsRouter.post("/:projectId/preview", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    res.status(404).json({ error: "project not found" })
    return
  }

  const latestMessage = await prisma.message.findFirst({
    where: {
      projectId,
      role: "ASSISTANT",
      fragment: {
        frontendTarKey: { not: null },
        backendTarKey: { not: null },
      },
    },
    orderBy: { createdAt: "desc" },
    include: { fragment: true },
  })

  if (!latestMessage?.fragment?.frontendTarKey || !latestMessage.fragment.backendTarKey) {
    res.status(404).json({ error: "No runnable fragment found for project" })
    return
  }

  try {
    const sandbox = await Sandbox.create("coding-preview")
    await sandbox.setTimeout(60_000 * 10 * 3)

    const frontendStateUrl = await getStateDownloadUrl(latestMessage.fragment.frontendTarKey)
    const backendStateUrl = await getStateDownloadUrl(latestMessage.fragment.backendTarKey)

    const frontendRestore = await sandbox.commands.run(
      `mkdir -p /home/user/frontend && curl -sL -o /tmp/frontend.tar.gz "${frontendStateUrl}" && tar -xzf /tmp/frontend.tar.gz -C /home/user/frontend && rm /tmp/frontend.tar.gz && cd /home/user/frontend && npm i`,
      { timeoutMs: 300_000 },
    )
    if (frontendRestore.exitCode !== 0) {
      throw new Error(`Frontend restore failed (exit ${frontendRestore.exitCode}):\n${frontendRestore.stderr}`)
    }

    const backendRestore = await sandbox.commands.run(
      `mkdir -p /home/user/backend && curl -sL -o /tmp/backend.tar.gz "${backendStateUrl}" && tar -xzf /tmp/backend.tar.gz -C /home/user/backend && rm /tmp/backend.tar.gz && cd /home/user/backend && npm i && npx prisma generate && npx prisma db push`,
      { timeoutMs: 300_000 },
    )
    if (backendRestore.exitCode !== 0) {
      throw new Error(`Backend restore failed (exit ${backendRestore.exitCode}):\n${backendRestore.stderr}`)
    }

    const frontendUrl = `https://${sandbox.getHost(8081)}`
    const backendUrl = `https://${sandbox.getHost(3000)}`

    await sandbox.files.write(
      "/home/user/backend/.env",
      stringifyEnv({
        PREVIEW_CORS_ORIGIN: frontendUrl,
      }),
    )
    await sandbox.files.write(
      "/home/user/frontend/.env",
      stringifyEnv({
        EXPO_PUBLIC_API_URL: backendUrl,
      }),
    )

    await sandbox.commands.run("cd /home/user/backend && npm run dev", {
      background: true,
      requestTimeoutMs: 60_000 * 10 * 3,
      timeoutMs: 60_000 * 10 * 3,
    })
    await sandbox.commands.run("cd /home/user/frontend && npm run dev", {
      background: true,
      requestTimeoutMs: 60_000 * 10 * 3,
      timeoutMs: 60_000 * 10 * 3,
    })

    res.status(200).json({ url: frontendUrl })
  } catch (error) {
    console.error("[projectsRouter.POST /:projectId/preview] Failed:", error)
    res.status(500).json({ error: "Failed to run preview" })
  }
})
