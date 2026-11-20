# SwapU — სტუდენტური კურსებისა და ჯგუფების გაცვლის პლატფორმა

**SwapU** არის თანამედროვე სრულფუნქციური ვებპლატფორმა (MVP), რომელიც შექმნილია პირველ ეტაპზე საქართველოს ბიზნესისა და ტექნოლოგიების უნივერსიტეტის (**BTU**) სტუდენტებისთვის და არქიტექტურულად მზადაა საქართველოს სხვა უნივერსიტეტების დასამატებლად.

## ტექნოლოგიური სტეკი

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Socket.IO Client
- **Backend:** Node.js, Express.js, TypeScript, Socket.IO, Zod, JWT, bcryptjs, Resend
- **Database:** PostgreSQL + Prisma ORM (13+ ნორმალიზებული მოდელი)

## გაშვების ინსტრუქცია

1. დააინსტალირეთ პაკეტები:
   ```bash
   npm run install:all
   ```
2. გაუშვით ლოკალური PostgreSQL (`dev:db`, თუ PostgreSQL უკვე არ გაქვთ დაყენებული), დააპუშეთ სქემა და ჩატვირთეთ BTU საწყისი მონაცემები:
   ```bash
   npm run dev:db
   npm run db:push
   npm run db:seed
   ```
3. გაუშვით სრული პროექტი (DB + Express API + React Frontend):
   ```bash
   npm run dev
   ```
4. გახსენით `http://localhost:5173`

## სატესტო ანგარიშები (Seed-ის შემდეგ)

- სტუდენტი: `nino.tsiklauri@btu.edu.ge` / `student123`
- სტუდენტი 2 (Smart Match წყვილი): `giorgi.kvaratskhelia@btu.edu.ge` / `student123`
- ადმინისტრატორი: `admin@btu.edu.ge` / `student123`
