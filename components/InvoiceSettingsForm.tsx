/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCompanySettings } from "@/lib/actions/admin";
import {
  InvoicePreview,
  type InvoicePreviewCompany,
} from "@/components/InvoicePreview";
import type { CompanyInfo } from "@/lib/company";

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export function InvoiceSettingsForm({ company }: { company: CompanyInfo }) {
  const [code, setCode] = useState(company.code);
  const [name, setName] = useState(company.name);
  const [brand, setBrand] = useState(company.brand);
  const [tagline, setTagline] = useState(company.tagline);
  const [legalName, setLegalName] = useState(company.legalName);
  const [uen, setUen] = useState(company.uen);
  const [address, setAddress] = useState(company.address);
  const [paymentTerms, setPaymentTerms] = useState(company.paymentTerms);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const logoObjectUrl = useObjectUrl(logoFile);
  const qrObjectUrl = useObjectUrl(qrFile);

  const preview: InvoicePreviewCompany = useMemo(
    () => ({
      brand,
      tagline,
      legalName,
      uen,
      addressLines: address
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      paymentTerms,
      logoSrc: logoObjectUrl || company.logoSrc,
      paynowQrSrc: qrObjectUrl || company.paynowQrSrc,
    }),
    [
      address,
      brand,
      company.logoSrc,
      company.paynowQrSrc,
      legalName,
      logoObjectUrl,
      paymentTerms,
      qrObjectUrl,
      tagline,
      uen,
    ]
  );

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCompanySettings(formData);
      if (result?.error) setError(result.error);
      else {
        setSaved(true);
        setLogoFile(null);
        setQrFile(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <form
        action={submit}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold">Company details</h2>
        <p className="mt-1 text-sm text-gray-500">
          Shown on printed invoices and receipts for this company.
        </p>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          Company ID (login)
          <input
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Company name
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Brand
          <input
            name="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Tagline
          <input
            name="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Legal name
          <input
            name="legalName"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          UEN
          <input
            name="uen"
            value={uen}
            onChange={(e) => setUen(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Address
          <textarea
            name="address"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Payment terms
          <input
            name="paymentTerms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className={inputCls}
          />
        </label>
        <ImageUploadField
          label="Company logo"
          name="logo"
          buttonLabel={logoFile || company.logoSrc ? "Change logo" : "Upload logo"}
          fileName={logoFile?.name}
          previewSrc={logoObjectUrl || company.logoSrc}
          onFile={setLogoFile}
        />
        <ImageUploadField
          label="PayNow QR (UEN)"
          name="paynowQr"
          buttonLabel={
            qrFile || company.paynowQrSrc ? "Change PayNow QR" : "Upload PayNow QR"
          }
          fileName={qrFile?.name}
          previewSrc={qrObjectUrl || company.paynowQrSrc}
          onFile={setQrFile}
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {saved && (
          <p className="mt-3 text-sm text-green-700">Invoice settings saved.</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save invoice settings"}
        </button>
      </form>

      <div className="xl:sticky xl:top-20">
        <h2 className="font-semibold">Invoice preview</h2>
        <p className="mt-1 text-sm text-gray-500">
          This is the branding used on new invoices for this company.
        </p>
        <div className="mt-4 h-[min(72vh,calc(100vh-12rem))] rounded-xl border border-gray-200 bg-gray-100 p-3">
          <InvoicePreview company={preview} />
        </div>
      </div>
    </div>
  );
}

function ImageUploadField({
  label,
  name,
  buttonLabel,
  fileName,
  previewSrc,
  onFile,
}: {
  label: string;
  name: string;
  buttonLabel: string;
  fileName?: string;
  previewSrc: string | null;
  onFile: (file: File | null) => void;
}) {
  return (
    <div className="mt-4">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            className="h-16 w-16 rounded-lg border border-gray-200 bg-white object-contain p-1"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300 text-center text-[11px] leading-tight text-gray-400">
            No image
          </div>
        )}
        <div>
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
            {buttonLabel}
            <input
              name={name}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-1 max-w-[16rem] truncate text-xs text-gray-500">
            {fileName || "PNG, JPEG, WebP, or GIF · max 2 MB"}
          </p>
        </div>
      </div>
    </div>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
