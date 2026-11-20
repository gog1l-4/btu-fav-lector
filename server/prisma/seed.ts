import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SwapU PostgreSQL database...');

  const btu = await prisma.university.upsert({
    where: { shortName: 'BTU' },
    update: {},
    create: {
      name: 'ბიზნესისა და ტექნოლოგიების უნივერსიტეტი (BTU)',
      shortName: 'BTU',
      emailDomain: 'btu.edu.ge',
      city: 'თბილისი',
      isActive: true,
    },
  });

  const tsu = await prisma.university.upsert({
    where: { shortName: 'TSU' },
    update: {},
    create: {
      name: 'თბილისის სახელმწიფო უნივერსიტეტი (TSU)',
      shortName: 'TSU',
      emailDomain: 'tsu.ge',
      city: 'თბილისი',
      isActive: true,
    },
  });

  const freeuni = await prisma.university.upsert({
    where: { shortName: 'FreeUni' },
    update: {},
    create: {
      name: 'თბილისის თავისუფალი უნივერსიტეტი',
      shortName: 'FreeUni',
      emailDomain: 'freeuni.edu.ge',
      city: 'თბილისი',
      isActive: true,
    },
  });

  // BTU Faculties
  const btuFacultiesData = [
    { name: 'ინფორმაციული ტექნოლოგიები', degreeLevel: 'ბაკალავრიატი' },
    { name: 'კომპიუტერული მეცნიერება და ხელოვნური ინტელექტი', degreeLevel: 'ბაკალავრიატი' },
    { name: 'ბიზნესის ადმინისტრირება — მენეჯმენტი', degreeLevel: 'ბაკალავრიატი' },
    { name: 'ბიზნესის ადმინისტრირება — ფინანსები', degreeLevel: 'ბაკალავრიატი' },
    { name: 'ციფრული მარკეტინგი', degreeLevel: 'ბაკალავრიატი' },
  ];

  const faculties: Record<string, string> = {};
  for (const f of btuFacultiesData) {
    const rec = await prisma.faculty.upsert({
      where: { universityId_name: { universityId: btu.id, name: f.name } },
      update: {},
      create: { universityId: btu.id, name: f.name, degreeLevel: f.degreeLevel },
    });
    faculties[f.name] = rec.id;
  }

  await prisma.faculty.upsert({
    where: { universityId_name: { universityId: tsu.id, name: 'კომპიუტერული მეცნიერებები' } },
    update: {},
    create: {
      universityId: tsu.id,
      name: 'კომპიუტერული მეცნიერებები',
      degreeLevel: 'ბაკალავრიატი',
    },
  });

  await prisma.faculty.upsert({
    where: { universityId_name: { universityId: freeuni.id, name: 'მათემატიკისა და კომპიუტერული მეცნიერებების სკოლა (MACS)' } },
    update: {},
    create: {
      universityId: freeuni.id,
      name: 'მათემატიკისა და კომპიუტერული მეცნიერებების სკოლა (MACS)',
      degreeLevel: 'ბაკალავრიატი',
    },
  });

  // BTU Courses
  const coursesSeed = [
    { code: 'IT-204', name: 'Front-end ვებ-პროგრამირება', faculty: 'ინფორმაციული ტექნოლოგიები', credits: 6 },
    { code: 'IT-301', name: 'Back-end პროგრამირება (Node.js)', faculty: 'ინფორმაციული ტექნოლოგიები', credits: 6 },
    { code: 'IT-210', name: 'მონაცემთა ბაზების მართვის სისტემები', faculty: 'ინფორმაციული ტექნოლოგიები', credits: 5 },
    { code: 'CS-202', name: 'ალგორითმები და მონაცემთა სტრუქტურები', faculty: 'კომპიუტერული მეცნიერება და ხელოვნური ინტელექტი', credits: 6 },
    { code: 'CS-305', name: 'მანქანური სწავლება (Machine Learning)', faculty: 'კომპიუტერული მეცნიერება და ხელოვნური ინტელექტი', credits: 6 },
    { code: 'BM-105', name: 'მენეჯმენტის საფუძვლები', faculty: 'ბიზნესის ადმინისტრირება — მენეჯმენტი', credits: 5 },
    { code: 'BF-201', name: 'კორპორაციული ფინანსები', faculty: 'ბიზნესის ადმინისტრირება — ფინანსები', credits: 5 },
    { code: 'DM-203', name: 'ციფრული მარკეტინგის სტრატეგია', faculty: 'ციფრული მარკეტინგი', credits: 5 },
  ];

  const courses: Record<string, string> = {};
  for (const c of coursesSeed) {
    const rec = await prisma.course.upsert({
      where: { universityId_code: { universityId: btu.id, code: c.code } },
      update: {},
      create: {
        universityId: btu.id,
        facultyId: faculties[c.faculty],
        code: c.code,
        name: c.name,
        credits: c.credits,
      },
    });
    courses[c.code] = rec.id;
  }

  // BTU Lecturers
  const lecturersSeed = [
    { fullName: 'რევაზ მაკალათია', department: 'ინფორმაციული ტექნოლოგიები' },
    { fullName: 'თამარ ბერიძე', department: 'ინფორმაციული ტექნოლოგიები' },
    { fullName: 'დავით კაპანაძე', department: 'ინფორმაციული ტექნოლოგიები' },
    { fullName: 'ნინო გელაშვილი', department: 'კომპიუტერული მეცნიერება' },
    { fullName: 'გიორგი ლომიძე', department: 'მენეჯმენტი და ბიზნესი' },
    { fullName: 'ეკატერინე ქავთარაძე', department: 'ფინანსები' },
    { fullName: 'სანდრო მაისურაძე', department: 'ციფრული მარკეტინგი' },
  ];

  const lecturers: Record<string, string> = {};
  for (const l of lecturersSeed) {
    const rec = await prisma.lecturer.upsert({
      where: { universityId_fullName: { universityId: btu.id, fullName: l.fullName } },
      update: {},
      create: { universityId: btu.id, fullName: l.fullName, department: l.department },
    });
    lecturers[l.fullName] = rec.id;
  }

  // BTU Groups
  const groupsSeed = [
    { courseCode: 'IT-204', lecturer: 'რევაზ მაკალათია', groupCode: 'FE-01', day: 'ორშაბათი', start: '12:00', end: '14:00', room: 'A-302' },
    { courseCode: 'IT-204', lecturer: 'რევაზ მაკალათია', groupCode: 'FE-02', day: 'ორშაბათი', start: '16:00', end: '18:00', room: 'A-305' },
    { courseCode: 'IT-204', lecturer: 'თამარ ბერიძე', groupCode: 'FE-03', day: 'სამშაბათი', start: '10:00', end: '12:00', room: 'B-201' },
    { courseCode: 'IT-301', lecturer: 'დავით კაპანაძე', groupCode: 'BE-01', day: 'ოთხშაბათი', start: '14:00', end: '16:00', room: 'A-401' },
    { courseCode: 'IT-301', lecturer: 'დავით კაპანაძე', groupCode: 'BE-02', day: 'ოთხშაბათი', start: '18:00', end: '20:00', room: 'A-402' },
    { courseCode: 'IT-210', lecturer: 'ნინო გელაშვილი', groupCode: 'DB-01', day: 'ხუთშაბათი', start: '11:00', end: '13:00', room: 'C-104' },
    { courseCode: 'IT-210', lecturer: 'ნინო გელაშვილი', groupCode: 'DB-02', day: 'ხუთშაბათი', start: '15:00', end: '17:00', room: 'C-105' },
    { courseCode: 'CS-202', lecturer: 'ნინო გელაშვილი', groupCode: 'ALG-01', day: 'პარასკევი', start: '12:00', end: '14:00', room: 'B-310' },
    { courseCode: 'BM-105', lecturer: 'გიორგი ლომიძე', groupCode: 'MGT-01', day: 'სამშაბათი', start: '13:00', end: '15:00', room: 'D-201' },
    { courseCode: 'BF-201', lecturer: 'ეკატერინე ქავთარაძე', groupCode: 'FIN-02', day: 'პარასკევი', start: '16:00', end: '18:00', room: 'D-108' },
    { courseCode: 'DM-203', lecturer: 'სანდრო მაისურაძე', groupCode: 'DM-01', day: 'ორშაბათი', start: '14:00', end: '16:00', room: 'B-102' },
  ];

  const groups: Record<string, string> = {};
  for (const g of groupsSeed) {
    const rec = await prisma.group.upsert({
      where: { courseId_groupCode: { courseId: courses[g.courseCode], groupCode: g.groupCode } },
      update: {},
      create: {
        universityId: btu.id,
        courseId: courses[g.courseCode],
        lecturerId: lecturers[g.lecturer],
        groupCode: g.groupCode,
        dayOfWeek: g.day,
        startTime: g.start,
        endTime: g.end,
        room: g.room,
      },
    });
    groups[g.groupCode] = rec.id;
  }

  // Demo Users
  const passwordHash = await bcrypt.hash('student123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@btu.edu.ge' },
    update: {},
    create: {
      firstName: 'ადმინ',
      lastName: 'სისტემა',
      email: 'admin@btu.edu.ge',
      passwordHash,
      role: 'ADMIN',
      universityId: btu.id,
      facultyId: faculties['ინფორმაციული ტექნოლოგიები'],
      studyYear: 4,
      isEmailVerified: true,
      studentVerificationStatus: 'VERIFIED',
      bio: 'SwapU პლატფორმის ადმინისტრატორი',
    },
  });

  const nino = await prisma.user.upsert({
    where: { email: 'nino.tsiklauri@btu.edu.ge' },
    update: {},
    create: {
      firstName: 'ნინო',
      lastName: 'წიკლაური',
      email: 'nino.tsiklauri@btu.edu.ge',
      passwordHash,
      role: 'STUDENT',
      universityId: btu.id,
      facultyId: faculties['ინფორმაციული ტექნოლოგიები'],
      studyYear: 2,
      isEmailVerified: true,
      studentVerificationStatus: 'VERIFIED',
      bio: 'BTU IT ფაკულტეტის მე-2 კურსის სტუდენტი.',
    },
  });

  const giorgi = await prisma.user.upsert({
    where: { email: 'giorgi.kvaratskhelia@btu.edu.ge' },
    update: {},
    create: {
      firstName: 'გიორგი',
      lastName: 'კვარაცხელია',
      email: 'giorgi.kvaratskhelia@btu.edu.ge',
      passwordHash,
      role: 'STUDENT',
      universityId: btu.id,
      facultyId: faculties['ინფორმაციული ტექნოლოგიები'],
      studyYear: 2,
      isEmailVerified: true,
      studentVerificationStatus: 'VERIFIED',
      bio: 'ვეძებ დილის/შუადღის ლექციების ჯგუფებს, პარალელურად ვმუშაობ სტაჟირებაზე.',
    },
  });

  const mariam = await prisma.user.upsert({
    where: { email: 'mariam.abuseridze@btu.edu.ge' },
    update: {},
    create: {
      firstName: 'მარიამ',
      lastName: 'აბუსერიძე',
      email: 'mariam.abuseridze@btu.edu.ge',
      passwordHash,
      role: 'STUDENT',
      universityId: btu.id,
      facultyId: faculties['ციფრული მარკეტინგი'],
      studyYear: 3,
      isEmailVerified: true,
      studentVerificationStatus: 'VERIFIED',
    },
  });

  const luka = await prisma.user.upsert({
    where: { email: 'luka.chikovani@gmail.com' },
    update: {},
    create: {
      firstName: 'ლუკა',
      lastName: 'ჩიქოვანი',
      email: 'luka.chikovani@gmail.com',
      passwordHash,
      role: 'STUDENT',
      universityId: btu.id,
      facultyId: faculties['კომპიუტერული მეცნიერება და ხელოვნური ინტელექტი'],
      studyYear: 2,
      isEmailVerified: true,
      studentVerificationStatus: 'PENDING_REVIEW',
      studentIdNumber: 'BTU-2024-8812',
      verificationNote: 'გთხოვთ დამიდასტუროთ სტუდენტის სტატუსი',
    },
  });

  // Only create demo listings if empty
  const existingListingsCount = await prisma.swapListing.count();
  if (existingListingsCount === 0) {
    // Reciprocal pair 1: Nino has 16:00 Front-end, wants 12:00. Giorgi has 12:00 Front-end, wants 16:00!
    const l1 = await prisma.swapListing.create({
      data: {
        authorId: nino.id,
        universityId: btu.id,
        courseId: courses['IT-204'],
        currentLecturerId: lecturers['რევაზ მაკალათია'],
        currentLecturerName: 'რევაზ მაკალათია',
        currentGroupId: groups['FE-02'],
        currentGroupCode: 'FE-02',
        currentDay: 'ორშაბათი',
        currentTime: '16:00',
        desiredLecturerId: lecturers['რევაზ მაკალათია'],
        desiredLecturerName: 'რევაზ მაკალათია',
        desiredGroupCode: 'FE-01',
        desiredDay: 'ორშაბათი',
        desiredTime: '12:00',
        comment: 'საღამოს სამსახურთან მემთხვევა 16:00-იანი ჯგუფი, ძალიან მჭირდება 12:00-ზე გადმოსვლა.',
      },
    });

    await prisma.swapListing.create({
      data: {
        authorId: giorgi.id,
        universityId: btu.id,
        courseId: courses['IT-204'],
        currentLecturerId: lecturers['რევაზ მაკალათია'],
        currentLecturerName: 'რევაზ მაკალათია',
        currentGroupId: groups['FE-01'],
        currentGroupCode: 'FE-01',
        currentDay: 'ორშაბათი',
        currentTime: '12:00',
        desiredLecturerId: lecturers['რევაზ მაკალათია'],
        desiredLecturerName: 'რევაზ მაკალათია',
        desiredGroupCode: 'FE-02',
        desiredDay: 'ორშაბათი',
        desiredTime: '16:00',
        comment: '12:00-ზე სხვა საგნის სემინარი დამემთხვა, სიამოვნებით გადავალ 16:00 საათზე.',
      },
    });

    await prisma.swapListing.create({
      data: {
        authorId: mariam.id,
        universityId: btu.id,
        courseId: courses['IT-301'],
        currentLecturerId: lecturers['დავით კაპანაძე'],
        currentLecturerName: 'დავით კაპანაძე',
        currentGroupId: groups['BE-02'],
        currentGroupCode: 'BE-02',
        currentDay: 'ოთხშაბათი',
        currentTime: '18:00',
        desiredLecturerName: 'დავით კაპანაძე',
        desiredGroupCode: 'BE-01',
        desiredDay: 'ოთხშაბათი',
        desiredTime: '14:00',
        comment: 'გავცვლი 18:00 ჯგუფს 14:00 საათიან ჯგუფში. შეიძლება სხვა ლექტორიც.',
      },
    });

    const l4 = await prisma.swapListing.create({
      data: {
        authorId: luka.id,
        universityId: btu.id,
        courseId: courses['IT-210'],
        currentLecturerId: lecturers['ნინო გელაშვილი'],
        currentLecturerName: 'ნინო გელაშვილი',
        currentGroupId: groups['DB-02'],
        currentGroupCode: 'DB-02',
        currentDay: 'ხუთშაბათი',
        currentTime: '15:00',
        desiredLecturerId: lecturers['ნინო გელაშვილი'],
        desiredLecturerName: 'ნინო გელაშვილი',
        desiredGroupCode: 'DB-01',
        desiredDay: 'ხუთშაბათი',
        desiredTime: '11:00',
        comment: 'ხუთშაბათს 11:00 საათიანი ჯგუფი მაწყობს ცხრილის გამო.',
      },
    });

    await prisma.swapListing.create({
      data: {
        authorId: adminUser.id,
        universityId: btu.id,
        courseId: courses['DM-203'],
        currentLecturerId: lecturers['სანდრო მაისურაძე'],
        currentLecturerName: 'სანდრო მაისურაძე',
        currentGroupId: groups['DM-01'],
        currentGroupCode: 'DM-01',
        currentDay: 'ორშაბათი',
        currentTime: '14:00',
        desiredTime: '16:00',
        desiredDay: 'ორშაბათი',
        comment: 'თუ ვინმეს გსურთ 14:00 ჯგუფში გადმოსვლა, მომწერეთ.',
      },
    });

    // Demo Offer + Notification
    await prisma.swapOffer.create({
      data: {
        listingId: l4.id,
        senderId: mariam.id,
        receiverId: luka.id,
        offeredGroupCode: 'DB-01',
        offeredLecturerName: 'ნინო გელაშვილი',
        offeredDay: 'ხუთშაბათი',
        offeredTime: '11:00',
        message: 'გამარჯობა! მაქვს DB-01 11:00 საათზე და მინდა 15:00-ზე გადასვლა.',
        status: 'PENDING',
      },
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: nino.id,
          type: 'SMART_MATCH',
          title: 'Smart Match: Front-end ვებ-პროგრამირება',
          body: 'გიორგი კვარაცხელია სთავაზობს 12:00 ჯგუფს და ეძებს 16:00-ს!',
          linkUrl: '/matches',
        },
        {
          userId: luka.id,
          type: 'NEW_OFFER',
          title: 'ახალი გაცვლის შეთავაზება!',
          body: 'მარიამ აბუსერიძე გთავაზობთ DB-01 ჯგუფის გაცვლას (ხუთშაბათი 11:00).',
          linkUrl: '/offers?tab=received',
        },
      ],
    });

    // Bookmark one listing for Nino
    await prisma.savedListing.create({
      data: {
        userId: nino.id,
        listingId: l1.id,
      },
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
