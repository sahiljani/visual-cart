import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding promo codes...");

    // Create 90FIRSTMONTH promo code
    await prisma.promoCode.upsert({
        where: { code: "90FIRSTMONTH" },
        update: {
            type: "ONE_TIME",
            discountPercent: 90,
            isActive: true,
            description: "90% off first month - one-time discount",
        },
        create: {
            code: "90FIRSTMONTH",
            type: "ONE_TIME",
            discountPercent: 90,
            isActive: true,
            description: "90% off first month - one-time discount",
        },
    });
    console.log("✓ Created promo code: 90FIRSTMONTH (90% off first month)");

    // Create 50MONTHLY promo code
    await prisma.promoCode.upsert({
        where: { code: "50MONTHLY" },
        update: {
            type: "RECURRING",
            discountPercent: 50,
            isActive: true,
            description: "50% off every month - recurring discount",
        },
        create: {
            code: "50MONTHLY",
            type: "RECURRING",
            discountPercent: 50,
            isActive: true,
            description: "50% off every month - recurring discount",
        },
    });
    console.log("✓ Created promo code: 50MONTHLY (50% off monthly)");

    console.log("\n✅ Promo codes seeded successfully!");
    console.log("\nTo manage promo codes:");
    console.log("  - Set isActive = true to enable a code");
    console.log("  - Set isActive = false to disable a code");
}

main()
    .catch((e) => {
        console.error("Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
