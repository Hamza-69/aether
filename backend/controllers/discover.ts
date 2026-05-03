import { Router } from "express"
import { prisma } from "../lib/prisma"

export const discoverRouter = Router()

// GET /api/discover — list published projects
discoverRouter.get("/", async (_req, res) => {
  try {
    const publishedProjects = await prisma.publishedProject.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
    })

    const formattedProjects = publishedProjects.map((p) => ({
      id: p.id,
      name: p.name,
      screenshotUrl: p.screenshotUrl,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      projectId: p.projectId,
      authorUsername: p.project.user.username,
    }))

    res.status(200).json({ publishedProjects: formattedProjects })
  } catch (error) {
    console.error("[discoverRouter.GET /] Failed:", error)
    res.status(500).json({ error: "Failed to list published projects" })
  }
})

// GET /api/discover/:id — fetch a single published project
discoverRouter.get("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const publishedProject = await prisma.publishedProject.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
    })

    if (!publishedProject) {
      res.status(404).json({ error: "Published project not found" })
      return
    }

    const formattedProject = {
      id: publishedProject.id,
      name: publishedProject.name,
      screenshotUrl: publishedProject.screenshotUrl,
      createdAt: publishedProject.createdAt.toISOString(),
      updatedAt: publishedProject.updatedAt.toISOString(),
      projectId: publishedProject.projectId,
      authorUsername: publishedProject.project.user.username,
    }

    res.status(200).json({ publishedProject: formattedProject })
  } catch (error) {
    console.error("[discoverRouter.GET /:id] Failed:", error)
    res.status(500).json({ error: "Failed to fetch published project" })
  }
})

// POST /api/discover/:id/clone — clone a published project
discoverRouter.post("/:id/clone", async (req, res) => {
  const { id } = req.params
  const userId = req.user!.id

  try {
    const publishedProject = await prisma.publishedProject.findUnique({
      where: { id },
    })

    if (!publishedProject) {
      res.status(404).json({ error: "Published project not found" })
      return
    }

    // Create a new project for the user
    const newProject = await prisma.project.create({
      data: {
        name: `Clone of ${publishedProject.name}`,
        userId,
      },
    })

    // Create the initial successful generation message
    const message = await prisma.message.create({
      data: {
        projectId: newProject.id,
        content: "Cloned from Discover",
        role: "ASSISTANT",
        type: "SUCCESS",
        completed: true,
      },
    })

    // Create the fragment with the code
    await prisma.fragment.create({
      data: {
        content: publishedProject.content,
        frontendTarKey: publishedProject.frontendTarKey,
        backendTarKey: publishedProject.backendTarKey,
        message: {
          connect: { id: message.id },
        },
      },
    })

    res.status(201).json({ project: newProject })
  } catch (error) {
    console.error("[discoverRouter.POST /:id/clone] Failed:", error)
    res.status(500).json({ error: "Failed to clone published project" })
  }
})
