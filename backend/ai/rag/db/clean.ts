import { prisma } from "../../../lib/prisma"

export async function cleanExpoDocs(): Promise<void> {
  await prisma.expoDocs.deleteMany({})
  console.log("Cleaned all ExpoDocs rows from DB")
}

export async function cleanNativeWindDocs(): Promise<void> {
  await prisma.nativeWindDocs.deleteMany({})
  console.log("Cleaned all NativeWindDocs rows from DB")
}

async function main() {
  await cleanExpoDocs()
  await cleanNativeWindDocs()
  await prisma.$disconnect()
}

const isMain = process.argv[1]?.endsWith("clean.ts") || process.argv[1]?.endsWith("clean")
if (isMain) {
  main().catch((err) => {
    console.error("Clean failed:", err)
    process.exit(1)
  })
}
