import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo organization
  const org = await prisma.organization.create({
    data: {
      name: 'Demo Company',
      slug: 'demo',
      plan: 'PRO',
    },
  });

  // Create SLA policies
  await prisma.slaPolicy.createMany({
    data: [
      { name: 'Urgent SLA', priority: 'URGENT', firstResponseMinutes: 30, resolutionMinutes: 240, organizationId: org.id },
      { name: 'High SLA', priority: 'HIGH', firstResponseMinutes: 60, resolutionMinutes: 480, organizationId: org.id },
      { name: 'Medium SLA', priority: 'MEDIUM', firstResponseMinutes: 240, resolutionMinutes: 1440, organizationId: org.id },
      { name: 'Low SLA', priority: 'LOW', firstResponseMinutes: 480, resolutionMinutes: 2880, organizationId: org.id },
    ],
  });

  const passwordHash = await bcrypt.hash('password123', 12);

  // Create admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  // Create agent
  const agent = await prisma.user.create({
    data: {
      email: 'agent@demo.com',
      passwordHash,
      firstName: 'Support',
      lastName: 'Agent',
      role: 'AGENT',
      organizationId: org.id,
    },
  });

  // Create end user
  const endUser = await prisma.user.create({
    data: {
      email: 'user@demo.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Customer',
      role: 'END_USER',
      organizationId: org.id,
    },
  });

  // Create tags
  const tags = await Promise.all(
    ['bug', 'feature', 'billing', 'urgent', 'documentation'].map((name) =>
      prisma.tag.create({ data: { name, organizationId: org.id } }),
    ),
  );

  // Create sample tickets
  const mediumSla = await prisma.slaPolicy.findFirst({
    where: { organizationId: org.id, priority: 'MEDIUM' },
  });

  const ticket1 = await prisma.ticket.create({
    data: {
      ticketNumber: 1,
      title: 'Cannot login to dashboard',
      description: 'I keep getting a 500 error when trying to log in. Cleared cookies and cache, still not working.',
      priority: 'HIGH',
      status: 'OPEN',
      organizationId: org.id,
      creatorId: endUser.id,
      assigneeId: agent.id,
      slaPolicyId: mediumSla?.id,
      dueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      ticketNumber: 2,
      title: 'Feature request: Dark mode',
      description: 'It would be great to have a dark mode option in the customer portal.',
      priority: 'LOW',
      status: 'OPEN',
      organizationId: org.id,
      creatorId: endUser.id,
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      ticketNumber: 3,
      title: 'Billing discrepancy on last invoice',
      description: 'I was charged $99 instead of the $49 plan I subscribed to. Please investigate.',
      priority: 'URGENT',
      status: 'PENDING',
      organizationId: org.id,
      creatorId: endUser.id,
      assigneeId: admin.id,
    },
  });

  // Add tags to tickets
  await prisma.ticketTag.createMany({
    data: [
      { ticketId: ticket1.id, tagId: tags[0].id }, // bug
      { ticketId: ticket2.id, tagId: tags[1].id }, // feature
      { ticketId: ticket3.id, tagId: tags[2].id }, // billing
      { ticketId: ticket3.id, tagId: tags[3].id }, // urgent
    ],
  });

  // Add comments
  await prisma.comment.create({
    data: {
      body: 'Hi, I can reproduce this issue. Working on a fix now.',
      ticketId: ticket1.id,
      authorId: agent.id,
    },
  });

  await prisma.comment.create({
    data: {
      body: 'Looks like a server-side session issue. Escalating to backend team.',
      ticketId: ticket1.id,
      authorId: agent.id,
      isInternal: true,
    },
  });

  await prisma.comment.create({
    data: {
      body: 'Thank you for looking into this!',
      ticketId: ticket1.id,
      authorId: endUser.id,
    },
  });

  // Create knowledge base
  const category = await prisma.articleCategory.create({
    data: {
      name: 'Getting Started',
      slug: 'getting-started',
      description: 'Basic guides to get you up and running',
      organizationId: org.id,
    },
  });

  await prisma.article.create({
    data: {
      title: 'How to create your first ticket',
      slug: 'how-to-create-your-first-ticket',
      content: 'To create a ticket, navigate to the Tickets page and click the "New Ticket" button. Fill in the title, description, and priority level. You can also assign it to a specific agent or add tags for categorization.',
      isPublished: true,
      categoryId: category.id,
      organizationId: org.id,
    },
  });

  console.log('Seed complete!');
  console.log('\nDemo accounts (password: password123):');
  console.log('  Admin: admin@demo.com');
  console.log('  Agent: agent@demo.com');
  console.log('  User:  user@demo.com');
  console.log('  Org slug: demo');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
