export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - جلب تصنيف محدد بواسطة الاسم (بدون استخدام dynamic routes)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: "اسم التصنيف مطلوب" },
        { status: 400 }
      );
    }

    const decodedName = decodeURIComponent(name);
    console.log("🔍 البحث عن التصنيف بالاسم:", decodedName);

    // ✅ البحث في قاعدة البيانات باستخدام الاسم
    const category = await prisma.categories.findFirst({
      where: { 
        name: {
          equals: decodedName,
          mode: 'insensitive'
        }
      },
    });

    console.log("📊 نتيجة البحث:", category);

    if (!category) {
      console.log("❌ التصنيف غير موجود:", decodedName);
      
      // ✅ محاولة البحث في جميع التصنيفات للتحقق
      const allCategories = await prisma.categories.findMany();
      console.log("📋 جميع التصنيفات المتاحة:", allCategories.map(c => c.name));
      
      return NextResponse.json(
        { 
          error: "التصنيف غير موجود",
          availableCategories: allCategories.map(c => c.name)
        }, 
        { status: 404 }
      );
    }

    console.log("✅ التصنيف موجود:", category.name);
    return NextResponse.json(category);
  } catch (error) {
    console.error("❌ Error fetching category by name:", error);
    return NextResponse.json(
      { error: "فشل في جلب بيانات التصنيف" },
      { status: 500 }
    );
  }
}

// PUT - تحديث تصنيف محدد بواسطة الاسم
export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    
    if (!name) {
      return NextResponse.json(
        { error: "اسم التصنيف مطلوب" },
        { status: 400 }
      );
    }

    const decodedName = decodeURIComponent(name);
    const data = await request.json();

    const category = await prisma.categories.findFirst({
      where: { 
        name: {
          equals: decodedName,
          mode: 'insensitive'
        }
      },
    });

    if (!category) {
      return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
    }

    const updatedCategory = await prisma.categories.update({
      where: { id: category.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.image !== undefined && { image: data.image }),
        ...(data.kind && { kind: data.kind }),
        ...(data.sub !== undefined && { sub: data.sub }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم تحديث التصنيف بنجاح",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "فشل في تحديث التصنيف" },
      { status: 500 }
    );
  }
}

// DELETE - حذف تصنيف محدد بواسطة الاسم
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    
    if (!name) {
      return NextResponse.json(
        { error: "اسم التصنيف مطلوب" },
        { status: 400 }
      );
    }

    const decodedName = decodeURIComponent(name);

    const category = await prisma.categories.findFirst({
      where: { 
        name: {
          equals: decodedName,
          mode: 'insensitive'
        }
      },
    });

    if (!category) {
      return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
    }

    await prisma.categories.delete({
      where: { id: category.id },
    });

    return NextResponse.json({
      success: true,
      message: "تم حذف التصنيف بنجاح",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "فشل في حذف التصنيف" }, { status: 500 });
  }
}