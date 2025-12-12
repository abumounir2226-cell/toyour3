import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // تأكدنا من استخدام النسخة الموحدة
import { readdirSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

// POST: المطابقة (كما هي)
export async function POST() {
  try {
    const uploadDir = "/home/mounir/images";
    if (!existsSync(uploadDir))
      return NextResponse.json({ error: "No dir" }, { status: 404 });

    const imageFiles = readdirSync(uploadDir);
    // فلترة بسيطة للامتدادات
    const validImages = imageFiles.filter((f) =>
      /\.(jpg|jpeg|png|webp|gif)$/i.test(f)
    );

    let matchedCount = 0;
    for (const imageFile of validImages) {
      const fileNameWithoutExt = path.parse(imageFile).name;
      // بحث سريع جداً
      const product = await prisma.products.findFirst({
        where: { item_code: fileNameWithoutExt },
        select: { unique_id: true },
      });

      if (product) {
        await prisma.products.update({
          where: { unique_id: product.unique_id },
          data: { images: `https://www.royakids.shop/images/${imageFile}` },
        });
        matchedCount++;
      }
    }
    return NextResponse.json({ success: true, matched: matchedCount });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: العرض (مخفف جداً جداً)
export async function GET() {
  try {
    console.log("⚡ Fetching products list...");

    // ❌ ألغينا الـ count لأنه ثقيل
    // ✅ نجلب فقط أول 20 منتج ليس لهم صور
    const productsWithoutImagesList = await prisma.products.findMany({
      where: {
        OR: [{ images: null }, { images: "" }],
      },
      select: {
        unique_id: true,
        item_code: true,
        item_name: true,
      },
      take: 20, // عدد قليل جداً للتجربة
      orderBy: { item_code: "asc" },
    });

    console.log(`✅ Found ${productsWithoutImagesList.length} products`);

    return NextResponse.json({
      // نرسل أرقام وهمية للإحصائيات مؤقتاً لتسريع الاستجابة
      statistics: {
        totalProducts: 0,
        productsWithImages: 0,
        productsWithoutImages: productsWithoutImagesList.length,
      },
      productsWithoutImages: productsWithoutImagesList,
    });
  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json({ error: "Database Error" }, { status: 500 });
  }
}
