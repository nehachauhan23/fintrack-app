"use client";

import { useRef, useEffect, useState } from "react";
import { Camera, Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import useFetch from "@/hooks/use-fetch";
import { scanReceipt } from "@/actions/transaction";

export function ReceiptScanner({ onScanComplete }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  const {
    loading: scanReceiptLoading,
    fn: scanReceiptFn,
    data: scannedData,
  } = useFetch(scanReceipt);

  const handleReceiptScan = async (file) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }

    // Show image preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    await scanReceiptFn(file);
  };

  useEffect(() => {
    if (scannedData && !scanReceiptLoading) {
      onScanComplete(scannedData);
      toast.success("Receipt scanned successfully");
      setPreview(null);
    }
  }, [scanReceiptLoading, scannedData]);

  return (
    <div className="space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleReceiptScan(file);
        }}
      />

      {preview && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <img src={preview} alt="Receipt preview" className="w-full max-h-40 object-contain p-2" />
          {scanReceiptLoading && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <p className="text-xs text-gray-500 font-medium">Analyzing receipt with AI...</p>
            </div>
          )}
          {!scanReceiptLoading && scannedData && (
            <div className="absolute inset-0 bg-emerald-50/80 flex items-center justify-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={24} />
              <p className="text-sm text-emerald-700 font-medium">Scan complete!</p>
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full h-11 border-dashed border-2 border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 gap-2 transition-all duration-200"
        onClick={() => fileInputRef.current?.click()}
        disabled={scanReceiptLoading}
      >
        {scanReceiptLoading ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Scanning with AI...
          </>
        ) : (
          <>
            <Camera size={16} />
            Scan Receipt with AI
          </>
        )}
      </Button>
      <p className="text-xs text-center text-gray-400">
        Upload a photo of your receipt to auto-fill transaction details
      </p>
    </div>
  );
}
