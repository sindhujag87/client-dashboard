import { PrismaClient, Priority, TaskStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  console.log("Seeding...");

  const admin = await prisma.user.create({
    data: { email: "admin@agency.dev", passwordHash: await hash("password123"), name: "Ava Admin", role: "ADMIN" },
  });

  const pm1 = await prisma.user.create({
    data: { email: "pm1@agency.dev", passwordHash: await hash("password123"), name: "Priya Manager", role: "PM" },
  });
  const pm2 = await prisma.user.create({
    data: { email: "pm2@agency.dev", passwordHash: await hash("password123"), name: "Paul Manager", role: "PM" },
  });

  const devs = await Promise.all(
    ["Ravi Dev", "Dana Dev", "Sam Dev", "Lee Dev"].map((name, i) =>
      prisma.user.create({
        data: { email: `dev${i + 1}@agency.dev`, passwordHash: bcrypt.hashSync("password123", 10), name, role: "DEVELOPER" },
      })
    )
  );

  const client1 = await prisma.client.create({ data: { name: "Acme Retail" } });
  const client2 = await prisma.client.create({ data: { name: "Northwind Health" } });
  const client3 = await prisma.client.create({ data: { name: "Globex Logistics" } });

  const project1 = await prisma.project.create({
    data: { name: "Acme Storefront Revamp", clientId: client1.id, createdById: pm1.id },
  });
  const project2 = await prisma.project.create({
    data: { name: "Northwind Patient Portal", clientId: client2.id, createdById: pm1.id },
  });
  const project3 = await prisma.project.create({
    data: { name: "Globex Fleet Tracker", clientId: client3.id, createdById: pm2.id },
  });

  const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "TODO", "IN_PROGRESS"];
  const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "MEDIUM", "HIGH"];

  const projects = [project1, project2, project3];
  const now = Date.now();
  let taskCounter = 0;
  const createdTasks = [];

  for (const project of projects) {
    for (let i = 0; i < 5; i++) {
      taskCounter++;
      const isPastOverdueSeed = taskCounter <= 2; // guarantees at least 2 overdue tasks total
      const dueDate = isPastOverdueSeed
        ? new Date(now - 3 * 24 * 60 * 60 * 1000) // 3 days in the past
        : new Date(now + (i + 1) * 2 * 24 * 60 * 60 * 1000); // upcoming

      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          title: `Task #${taskCounter}: ${["Set up CI", "Fix layout bug", "Add pagination", "Write tests", "Design review"][i % 5]}`,
          description: "Seeded task for demo purposes.",
          assignedToId: devs[taskCounter % devs.length].id,
          status: isPastOverdueSeed ? statuses[i % statuses.length] : statuses[i % statuses.length],
          priority: priorities[i % priorities.length],
          dueDate,
          isOverdue: isPastOverdueSeed,
        },
      });
      createdTasks.push({ task, project });
    }
  }

  // Pre-existing activity log entries so the feed isn't empty on first load
  for (let i = 0; i < 20; i++) {
    const { task, project } = createdTasks[i % createdTasks.length];
    const actor = devs[i % devs.length];
    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        taskId: task.id,
        userId: actor.id,
        action: i % 3 === 0 ? "moved task" : "created task",
        fromStatus: i % 3 === 0 ? "TODO" : null,
        toStatus: i % 3 === 0 ? "IN_PROGRESS" : task.status,
        createdAt: new Date(now - (20 - i) * 60 * 60 * 1000),
      },
    });
  }

  console.log("Seed complete:");
  console.log(`  Admin login:      admin@agency.dev / password123`);
  console.log(`  PM logins:        pm1@agency.dev, pm2@agency.dev / password123`);
  console.log(`  Developer logins: dev1..dev4@agency.dev / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
