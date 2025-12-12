"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";

export default function BulkProductsUpload({ onClose, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewData, setPreviewData] = useState([]);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const requiredColumns = [
    "master_code",
    "item_code",
    "item_name",
    "color",
    "size",
    "out_price",
    "cur_qty",
    "group_name",
    "kind_name",
    // ❌ إزالة type_id من الأعمدة المطلوبة
  ];

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const validationErrors = validateAndPrepareData(jsonData);
        if (validationErrors.length > 0) {
          setErrors(validationErrors);
          setPreviewData([]);
          return;
        }

        setErrors([]);
        setPreviewData(jsonData);
      } catch (error) {
        setErrors(["خطأ في قراءة ملف Excel: " + error.message]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateAndPrepareData = (data) => {
    const errors = [];

    if (data.length === 0) {
      errors.push("الملف لا يحتوي على بيانات");
      return errors;
    }

    const firstRow = data[0];
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));

    if (missingColumns.length > 0) {
      errors.push(`الأعمدة المفقودة: ${missingColumns.join(", ")}`);
    }

    data.forEach((row, index) => {
      const rowNumber = index + 2;

      // ✅ تحويل جميع الحقول النصية إلى string
      if (row.master_code) row.master_code = row.master_code.toString().trim();
      if (row.item_code) row.item_code = row.item_code.toString().trim();
      if (row.item_name) row.item_name = row.item_name.toString().trim();
      if (row.color) row.color = row.color.toString().trim();
      if (row.size) row.size = row.size.toString().trim();
      if (row.group_name) row.group_name = row.group_name.toString().trim();
      if (row.kind_name) row.kind_name = row.kind_name.toString().trim();

      if (!row.master_code || row.master_code === "") {
        errors.push(`الصف ${rowNumber}: master_code مطلوب`);
      }

      if (!row.item_name || row.item_name === "") {
        errors.push(`الصف ${rowNumber}: item_name مطلوب`);
      }

      if (
        row.out_price === undefined ||
        row.out_price === null ||
        row.out_price === ""
      ) {
        errors.push(`الصف ${rowNumber}: out_price مطلوب`);
      } else {
        const price = parseFloat(row.out_price);
        if (isNaN(price)) {
          errors.push(`الصف ${rowNumber}: out_price يجب أن يكون رقماً`);
        }
      }

      if (
        row.cur_qty === undefined ||
        row.cur_qty === null ||
        row.cur_qty === ""
      ) {
        errors.push(`الصف ${rowNumber}: cur_qty مطلوب`);
      } else {
        const qty = parseInt(row.cur_qty);
        if (isNaN(qty)) {
          errors.push(`الصف ${rowNumber}: cur_qty يجب أن يكون رقماً`);
        }
      }

      // ✅ تعيين القيم الافتراضية كـ strings
      if (!row.item_code || row.item_code === "") {
        row.item_code = row.master_code;
      }

      if (!row.color || row.color === "") {
        row.color = "افتراضي";
      }

      if (!row.size || row.size === "") {
        row.size = "ONE SIZE";
      }

      if (!row.group_name || row.group_name === "") {
        row.group_name = "عام";
      }

      if (!row.kind_name || row.kind_name === "") {
        row.kind_name = "عام";
      }
    });

    return errors;
  };

  const handleUpload = async () => {
    if (previewData.length === 0) return;

    setUploading(true);
    setProgress(10);

    try {
      // ✅ تحضير جميع المنتجات مع التأكد من أن جميع الحقول نصية
      const productsToUpload = previewData.map((product) => {
        const stor_id = 0; // ✅ المخزن الرئيسي دائماً
        const type_id = 0; // ✅ type_id دائماً 0

        // ✅ إنشاء unique_id تلقائياً بناء على master_code + type_id + stor_id
        const unique_id = `${product.master_code}-${type_id}-${stor_id}`;

        return {
          unique_id: unique_id,
          master_code: product.master_code.toString(),
          item_code: product.item_code.toString(),
          item_name: product.item_name.toString(),
          color: product.color.toString(),
          size: product.size.toString(),
          out_price: parseFloat(product.out_price) || 0,
          cur_qty: parseInt(product.cur_qty) || 0,
          group_name: product.group_name.toString(),
          kind_name: product.kind_name.toString(),
          images: (product.images || "").toString(),
          stor_id: stor_id,
          type_id: type_id,
          av_price: parseFloat(product.out_price) || 0,
        };
      });

      console.log("🔄 إرسال جميع المنتجات:", productsToUpload.length, "منتج");
      console.log("📋 نموذج من البيانات المرسلة:", productsToUpload[0]);

      setProgress(30);

      // ✅ إرسال جميع المنتجات في طلب واحد
      const response = await fetch("/api/products/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ products: productsToUpload }),
      });

      setProgress(70);

      // ✅ التحقق من حالة الرد
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`خطأ في الخادم: ${response.status} - ${errorText}`);
      }

      // ✅ تحليل الرد
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error("❌ خطأ في تحليل JSON:", jsonError);
        throw new Error("رد غير صالح من الخادم");
      }

      setProgress(100);

      if (result.success) {
        alert(
          `✅ تم إضافة ${result.addedCount} منتج بنجاح من أصل ${productsToUpload.length}`
        );
        onSuccess();
        onClose();
      } else {
        throw new Error(result.error || "فشل في إضافة المنتجات");
      }
    } catch (error) {
      console.error("❌ Error uploading products:", error);
      alert("❌ فشل في إضافة المنتجات: " + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        master_code: "PROD-001",
        item_code: "ITEM-001",
        item_name: "منتج مثال 1",
        color: "أحمر",
        size: "M",
        out_price: 100,
        cur_qty: 50,
        group_name: "ملابس",
        kind_name: "تيشيرت",
        images: "",
      },
      {
        master_code: "PROD-002",
        item_code: "ITEM-002",
        item_name: "منتج مثال 2",
        color: "أزرق",
        size: "L",
        out_price: 150,
        cur_qty: 30,
        group_name: "ملابس",
        kind_name: "بنطلون",
        images: "",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "المنتجات");
    XLSX.writeFile(workbook, "نموذج_المنتجات.xlsx");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            إضافة منتجات متعددة
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                رفع جميع المنتجات مرة واحدة
              </h3>
              <button
                onClick={downloadTemplate}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                📥 تحميل النموذج
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-blue-900 mb-2">معلومات مهمة:</h4>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>
                  • <strong>unique_id</strong> سيتم إنشاؤه تلقائياً:
                  master_code-0-0
                </li>
                <li>
                  • <strong>type_id</strong> دائماً 0 (يتم تعيينه تلقائياً)
                </li>
                <li>
                  • <strong>stor_id</strong> دائماً 0 (المخزن الرئيسي)
                </li>
                <li>
                  • <strong>master_code</strong> و <strong>item_name</strong>{" "}
                  مطلوبان
                </li>
                <li>
                  • <strong>out_price</strong> و <strong>cur_qty</strong> يجب أن
                  يكونا أرقاماً
                </li>
              </ul>
            </div>
          </div>

          <div className="mb-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx, .xls"
                className="hidden"
              />

              <div className="mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  اختر ملف Excel
                </h3>
                <p className="text-gray-600">
                  سيتم رفع جميع المنتجات في عملية واحدة
                </p>
                {previewData.length > 0 && (
                  <p className="text-green-600 font-medium mt-2">
                    ✅ جاهز لرفع {previewData.length} منتج
                  </p>
                )}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                اختر ملف Excel
              </button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-900 mb-2">
                يجب تصحيح الأخطاء قبل الرفع:
              </h4>
              <ul className="text-red-700 text-sm space-y-1 max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  معاينة البيانات ({previewData.length} منتج)
                </h3>
                <span className="text-sm text-gray-500">
                  عرض أول 10 منتجات فقط للمعاينة
                </span>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-right border">الكود</th>
                      <th className="px-3 py-2 text-right border">الاسم</th>
                      <th className="px-3 py-2 text-right border">اللون</th>
                      <th className="px-3 py-2 text-right border">المقاس</th>
                      <th className="px-3 py-2 text-right border">السعر</th>
                      <th className="px-3 py-2 text-right border">الكمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 10).map((product, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-3 py-2 border text-xs font-mono">
                          {product.master_code}
                        </td>
                        <td className="px-3 py-2 border text-xs text-right">
                          {product.item_name}
                        </td>
                        <td className="px-3 py-2 border text-xs">
                          {product.color}
                        </td>
                        <td className="px-3 py-2 border text-xs">
                          {product.size}
                        </td>
                        <td className="px-3 py-2 border text-xs">
                          {product.out_price} ج.م
                        </td>
                        <td className="px-3 py-2 border text-xs">
                          {product.cur_qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 10 && (
                  <div className="bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
                    + {previewData.length - 10} منتج إضافي
                  </div>
                )}
              </div>
            </div>
          )}

          {uploading && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>جاري رفع جميع المنتجات...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                يتم رفع {previewData.length} منتج في عملية واحدة - لا تغلق
                الصفحة
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            إلغاء
          </button>

          <button
            onClick={handleUpload}
            disabled={
              uploading || previewData.length === 0 || errors.length > 0
            }
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? `جاري الرفع...` : `رفع ${previewData.length} منتج`}
          </button>
        </div>
      </div>
    </div>
  );
}
