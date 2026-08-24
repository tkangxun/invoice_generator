"use client";

export function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "PAID"
      ? "bg-green-100 text-green-700"
      : status === "PARTIAL"
        ? "bg-sky-100 text-sky-800"
        : status === "VOIDED"
          ? "bg-gray-200 text-gray-700"
          : "bg-amber-100 text-amber-700";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}
    >
      {status}
    </span>
  );
}
