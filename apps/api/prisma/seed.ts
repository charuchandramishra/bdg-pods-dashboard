import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { normalizeKey, overallCompletion } from '@bdg-pods/shared';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const userHash = await bcrypt.hash('user1234', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bdgpods.local' },
    update: {},
    create: {
      email: 'admin@bdgpods.local',
      name: 'Admin User',
      role: Role.ADMIN,
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@bdgpods.local' },
    update: {},
    create: {
      email: 'viewer@bdgpods.local',
      name: 'Viewer User',
      role: Role.USER,
      passwordHash: userHash,
    },
  });

  const bdgSeed = [
    {
      memberName: 'Akshay Mishra',
      totalInbound: 10,
      totalOutbound: 8,
      apacInbound: 1,
      apacOutbound: 3,
      menaInbound: 1,
      menaOutbound: 2,
      internationalInbound: 0,
      internationalOutbound: 0,
      ukeuInbound: 3,
      ukeuOutbound: 2,
      naInbound: 5,
      naOutbound: 1,
    },
    {
      memberName: 'Mohit Pateria',
      totalInbound: 15,
      totalOutbound: 10,
      apacInbound: 8,
      apacOutbound: 10,
      menaInbound: 2,
      menaOutbound: 0,
      internationalInbound: 0,
      internationalOutbound: 0,
      ukeuInbound: 0,
      ukeuOutbound: 0,
      naInbound: 5,
      naOutbound: 0,
    },
    {
      memberName: 'Anand Raj',
      totalInbound: 4,
      totalOutbound: 2,
      apacInbound: 2,
      apacOutbound: 1,
      menaInbound: 1,
      menaOutbound: 0,
      internationalInbound: 0,
      internationalOutbound: 0,
      ukeuInbound: 1,
      ukeuOutbound: 1,
      naInbound: 0,
      naOutbound: 0,
    },
    {
      memberName: 'Krishnam Gupta',
      totalInbound: 0,
      totalOutbound: 6,
      apacInbound: 0,
      apacOutbound: 0,
      menaInbound: 0,
      menaOutbound: 0,
      internationalInbound: 0,
      internationalOutbound: 0,
      ukeuInbound: 0,
      ukeuOutbound: 6,
      naInbound: 0,
      naOutbound: 0,
    },
    {
      memberName: 'Mohinder',
      totalInbound: 4,
      totalOutbound: 10,
      apacInbound: 1,
      apacOutbound: 1,
      menaInbound: 0,
      menaOutbound: 0,
      internationalInbound: 0,
      internationalOutbound: 0,
      ukeuInbound: 1,
      ukeuOutbound: 1,
      naInbound: 2,
      naOutbound: 8,
    },
  ];

  for (const m of bdgSeed) {
    await prisma.bdgMember.upsert({
      where: { normalizedMemberName: normalizeKey(m.memberName) },
      update: {
        ...m,
        periodStart: new Date('2026-08-24'),
        periodEnd: new Date('2026-08-27'),
      },
      create: {
        ...m,
        normalizedMemberName: normalizeKey(m.memberName),
        periodStart: new Date('2026-08-24'),
        periodEnd: new Date('2026-08-27'),
      },
    });
  }

  const podsSeed = [
    {
      name: 'TeleHealth',
      description:
        'Remote healthcare consultations platform with appointments, video, and payments.',
      status: 'in progress',
      startDate: new Date('2026-08-04'),
      developers: 'Abhishek Jeena / Aniket Jha',
      machineOwner: 'Abhishek Jeena',
      machineAlignedToProject: 'Demo SDD',
      feCompletion: 85,
      beCompletion: 88,
      integrationCompletion: 82,
      daily: [
        { date: '2026-09-01', fe: 85, be: 88, integ: 82 },
        { date: '2026-09-02', fe: 87, be: 90, integ: 85 },
        { date: '2026-09-03', fe: 90, be: 92, integ: 88 },
      ],
    },
    {
      name: 'WMS Pick',
      description: 'End-to-end Warehouse Management System.',
      status: 'in progress',
      startDate: new Date('2026-08-15'),
      developers: 'Prachi Pathak',
      machineOwner: 'Aditi Goel',
      machineAlignedToProject: 'LMS',
      feCompletion: 29,
      beCompletion: 74,
      integrationCompletion: 66,
      daily: [
        { date: '2026-09-01', fe: 29, be: 74, integ: 66 },
        { date: '2026-09-02', fe: 31, be: 89, integ: 78 },
      ],
    },
    {
      name: 'CLM',
      description: 'Contract Lifecycle Management system.',
      status: 'in progress',
      startDate: new Date('2026-08-15'),
      developers: 'Pooja',
      machineOwner: 'Vikash Saini',
      machineAlignedToProject: 'kondaro',
      feCompletion: 58,
      beCompletion: 70,
      integrationCompletion: 65,
      daily: [
        { date: '2026-09-01', fe: 58, be: 70, integ: 65 },
        { date: '2026-09-02', fe: 75, be: 78, integ: 70 },
      ],
    },
    {
      name: 'smartFetch',
      description: 'Internal developer tool for mapping reusable features.',
      status: 'wait for testing',
      startDate: new Date('2026-07-29'),
      developers: 'Bhuvin Singla',
      machineOwner: 'Ashish Singh',
      machineAlignedToProject: 'Dental Genie',
      feCompletion: 80,
      beCompletion: 85,
      integrationCompletion: 82,
      daily: [{ date: '2026-09-01', fe: 80, be: 85, integ: 82 }],
    },
    {
      name: 'Support/ Ticket',
      description: 'IT service management and support platform.',
      status: 'in progress',
      startDate: new Date('2026-08-15'),
      developers: 'Sujal Anand',
      machineOwner: 'Ajay Pandey',
      machineAlignedToProject: 'Palzar',
      feCompletion: 6,
      beCompletion: 12,
      integrationCompletion: 5,
      daily: [{ date: '2026-09-01', fe: 6, be: 12, integ: 5 }],
    },
  ];

  for (const p of podsSeed) {
    const pod = await prisma.pod.upsert({
      where: { normalizedName: normalizeKey(p.name) },
      update: {
        name: p.name,
        description: p.description,
        status: p.status,
        startDate: p.startDate,
        developers: p.developers,
        machineOwner: p.machineOwner,
        machineAlignedToProject: p.machineAlignedToProject,
        feCompletion: p.feCompletion,
        beCompletion: p.beCompletion,
        integrationCompletion: p.integrationCompletion,
      },
      create: {
        name: p.name,
        normalizedName: normalizeKey(p.name),
        description: p.description,
        status: p.status,
        startDate: p.startDate,
        developers: p.developers,
        machineOwner: p.machineOwner,
        machineAlignedToProject: p.machineAlignedToProject,
        feCompletion: p.feCompletion,
        beCompletion: p.beCompletion,
        integrationCompletion: p.integrationCompletion,
      },
    });

    for (const d of p.daily) {
      await prisma.podDailyUpdate.upsert({
        where: {
          podId_date: { podId: pod.id, date: new Date(d.date) },
        },
        update: {
          feCompletion: d.fe,
          beCompletion: d.be,
          integrationCompletion: d.integ,
        },
        create: {
          podId: pod.id,
          date: new Date(d.date),
          feCompletion: d.fe,
          beCompletion: d.be,
          integrationCompletion: d.integ,
        },
      });
    }

    // silence unused import warning in case of tree shaking
    void overallCompletion(p.feCompletion, p.beCompletion, p.integrationCompletion);
  }

  console.log('Seed complete.');
  console.log('Admin: admin@bdgpods.local / admin123');
  console.log('User:  viewer@bdgpods.local / user1234');
  console.log(`Admin id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
