import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ زيادة وقت الـ timeout لتجنب خطأ 502
export const maxDuration = 60; // 60 ثانية
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { products } = await request.json();

    console.log("🔄 استلام طلب رفع جماعي:", products?.length, "منتج");

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "يجب إرسال مصفوفة من المنتجات",
        },
        { status: 400 }
      );
    }

    // ✅ زيادة الحد الأقصى
    if (products.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن رفع أكثر من 5000 منتج في مرة واحدة",
        },
        { status: 400 }
      );
    }

    const results = {
      addedCount: 0,
      skippedCount: 0,
      errors: [] as string[],
    };

    console.log("⏳ بدء عملية الإضافة...");

    // ✅ استخدام transaction مع معالجة أفضل للأخطاء
    try {
      await prisma.$transaction(
        async (tx) => {
          for (let i = 0; i < products.length; i++) {
            const productData = products[i];

            try {
              // ✅ التحقق من البيانات المطلوبة وتأكيد التحويل إلى string
              if (!productData.master_code || !productData.item_name) {
                results.errors.push(
                  `بيانات ناقصة للمنتج: ${
                    productData.master_code || "غير معروف"
                  }`
                );
                results.skippedCount++;
                continue;
              }

              // ✅ type_id دائماً 0 و stor_id دائماً 0
              const type_id = 0;
              const stor_id = 0;

              // ✅ إنشاء unique_id تلقائياً بناء على master_code + type_id + stor_id
              const unique_id = `${productData.master_code}-${type_id}-${stor_id}`;

              // ✅ تأكيد أن جميع الحقول نصية
              const cleanProductData = {
                unique_id: unique_id,
                master_code: productData.master_code.toString(),
                item_code:
                  productData.item_code?.toString() ||
                  productData.master_code.toString(),
                item_name: productData.item_name.toString(),
                color: (productData.color || "افتراضي").toString(),
                size: (productData.size || "ONE SIZE").toString(),
                out_price: parseFloat(productData.out_price) || 0,
                av_price:
                  parseFloat(productData.av_price) ||
                  parseFloat(productData.out_price) ||
                  0,
                cur_qty: parseInt(productData.cur_qty) || 0,
                group_name: (productData.group_name || "عام").toString(),
                kind_name: (productData.kind_name || "عام").toString(),
                images: (productData.images || "").toString(),
                stor_id: stor_id,
                type_id: type_id,
              };

              // ✅ التحقق إذا كان المنتج موجوداً بالفعل
              const existingProduct = await tx.products.findUnique({
                where: { unique_id: cleanProductData.unique_id },
              });

              if (existingProduct) {
                results.errors.push(
                  `المنتج موجود مسبقاً: ${cleanProductData.unique_id}`
                );
                results.skippedCount++;
                continue;
              }

              // ✅ إنشاء المنتج الجديد
              await tx.products.create({
                data: {
                  unique_id: cleanProductData.unique_id,
                  master_code: cleanProductData.master_code,
                  item_code: cleanProductData.item_code,
                  item_name: cleanProductData.item_name,
                  color: cleanProductData.color,
                  size: cleanProductData.size,
                  out_price: cleanProductData.out_price,
                  av_price: cleanProductData.av_price,
                  cur_qty: cleanProductData.cur_qty,
                  group_name: cleanProductData.group_name,
                  kind_name: cleanProductData.kind_name,
                  images: cleanProductData.images,
                  stor_id: cleanProductData.stor_id,
                  type_id: cleanProductData.type_id,
                  unit_name: "قطعة",
                  class_name: cleanProductData.group_name,
                  place_name: "المخزن الرئيسي",
                  // الحقول الإضافية المطلوبة
                  item_id: 0,
                  unit_id: 0,
                  unit_convert: 1.0,
                  multi_unit: false,
                  multi_type: false,
                  unit_def1_id: 0,
                  group_id: 0,
                  class_id: 0,
                  is_basic_unit: true,
                  kind_id: 0,
                  place_id: 0,
                  unit_name_id: 0,
                },
              });

              results.addedCount++;

              // ✅ عرض تقدم كل 100 منتج
              if (results.addedCount % 100 === 0) {
                console.log(
                  `📊 تم إضافة ${results.addedCount} منتج حتى الآن...`
                );
              }
            } catch (error) {
              console.error(
                `❌ خطأ في إضافة المنتج ${productData.master_code}:`,
                error
              );
              results.errors.push(
                `خطأ في ${productData.master_code}: ${error.message}`
              );
              results.skippedCount++;
            }
          }
        },
        {
          timeout: 60000, // ✅ زيادة وقت الـ transaction إلى 60 ثانية
        }
      );
    } catch (transactionError) {
      console.error("❌ خطأ في الـ transaction:", transactionError);
      throw new Error(`فشل في معالجة البيانات: ${transactionError.message}`);
    }

    console.log(
      `🎉 تم الانتهاء من الرفع الجماعي: ${results.addedCount} مضافة, ${results.skippedCount} مرفوضة`
    );

    return NextResponse.json({
      success: true,
      message: `تمت العملية بنجاح`,
      addedCount: results.addedCount,
      skippedCount: results.skippedCount,
      totalProcessed: products.length,
      errors: results.errors.slice(0, 10), // إرجاع أول 10 أخطاء فقط
    });
  } catch (error) {
    console.error("❌ Error in bulk products upload:", error);

    return NextResponse.json(
      {
        success: false,
        error: "فشل في رفع المنتجات: " + error.message,
      },
      { status: 500 }
    );
  }
}
