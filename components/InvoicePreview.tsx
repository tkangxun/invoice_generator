/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";

const NAVY = "#1f3864";
const PAGE_W = 210 * (96 / 25.4);
const PAGE_H = 270 * (96 / 25.4);

export type InvoicePreviewCompany = {
  brand: string;
  tagline: string;
  legalName: string;
  uen: string;
  addressLines: string[];
  paymentTerms: string;
  logoSrc: string | null;
  paynowQrSrc: string | null;
};

export function InvoicePreview({ company }: { company: InvoicePreviewCompany }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width < 1 || height < 1) return;
      setScale(Math.min(width / PAGE_W, height / PAGE_H, 1));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div
        className="shrink-0"
        style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
      >
        <div
          className="flex flex-col bg-white px-14 py-12 shadow"
          style={{
            width: PAGE_W,
            height: PAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <InvoicePreviewBody company={company} />
        </div>
      </div>
    </div>
  );
}

function InvoicePreviewBody({ company }: { company: InvoicePreviewCompany }) {
  return (
    <>
      <div
        className="flex items-start justify-between border-b pb-4"
        style={{ borderColor: NAVY }}
      >
        <div>
          {company.logoSrc ? (
            <img
              src={company.logoSrc}
              alt={company.brand}
              className="h-14 w-auto max-w-[220px] object-contain"
            />
          ) : (
            <div className="font-serif text-2xl font-bold" style={{ color: NAVY }}>
              {company.brand || "Company logo"}
            </div>
          )}
          {company.tagline ? (
            <div className="mt-1 text-xs italic text-gray-500">
              {company.tagline}
            </div>
          ) : null}
        </div>
        <div className="text-right">
          <div
            className="font-serif text-3xl font-bold tracking-wide"
            style={{ color: NAVY }}
          >
            INVOICE
          </div>
          <div className="mt-1 text-sm text-gray-700">INV-PREVIEW</div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-6 text-sm">
        <div>
          <div
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: NAVY }}
          >
            From
          </div>
          <div className="mt-1 font-semibold" style={{ color: NAVY }}>
            {company.legalName || "Legal name"}
          </div>
          <div className="text-gray-700">UEN: {company.uen || "—"}</div>
          {company.addressLines.map((line) => (
            <div key={line} className="text-gray-700">
              {line}
            </div>
          ))}
        </div>
        <div>
          <div
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: NAVY }}
          >
            Billed To
          </div>
          <div className="mt-1 font-semibold" style={{ color: NAVY }}>
            Sample Customer
          </div>
          <div className="text-gray-700">123 Example Road</div>
          <div className="text-gray-700">Singapore 123456</div>
        </div>
        <div>
          <div
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: NAVY }}
          >
            Invoice Date
          </div>
          <div className="mt-1 text-gray-700">25/08/2026</div>
          <div
            className="mt-3 text-xs font-bold uppercase tracking-wide"
            style={{ color: NAVY }}
          >
            Due Date
          </div>
          <div className="mt-1 text-gray-700">Upon receipt</div>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="text-left text-white" style={{ backgroundColor: NAVY }}>
            <th className="px-3 py-2 font-semibold">Description</th>
            <th className="px-3 py-2 text-right font-semibold">Qty</th>
            <th className="px-3 py-2 text-right font-semibold">Rate</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="px-3 py-2.5">Personal training (5 sessions)</td>
            <td className="px-3 py-2.5 text-right">1</td>
            <td className="px-3 py-2.5 text-right">S$375.00</td>
            <td className="px-3 py-2.5 text-right">S$375.00</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 flex justify-end">
        <div className="w-72 text-sm">
          <div className="flex justify-between border-b border-gray-200 px-3 py-2">
            <span className="text-gray-600">Subtotal</span>
            <span>S$375.00</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-bold">AMOUNT TO BE PAID</span>
            <span className="text-lg font-bold" style={{ color: NAVY }}>
              S$375.00
            </span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-start justify-between pt-10">
        <div className="text-sm">
          <div
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: NAVY }}
          >
            Payment
          </div>
          <div className="mt-2 font-semibold" style={{ color: NAVY }}>
            PayNow to UEN
          </div>
          <div className="text-gray-700">{company.uen || "—"}</div>
          <div className="text-gray-700">
            ({company.legalName || "Legal name"})
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Terms: {company.paymentTerms || "Due on receipt"}
          </div>
        </div>
        {company.paynowQrSrc ? (
          <img
            src={company.paynowQrSrc}
            alt="PayNow QR code"
            className="h-32 w-32 object-contain"
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center border border-dashed border-gray-300 text-center text-xs text-gray-400">
            PayNow QR
          </div>
        )}
      </div>
    </>
  );
}
