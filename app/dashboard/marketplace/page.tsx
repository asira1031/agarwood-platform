"use client";

import Link from "next/link";

const products = [
  {
    name: "Organic Fertilizer",
    price: "₱350.00",
    note: "Supports soil nutrition and steady agarwood growth.",
    stock: "Available",
    icon: "🌱",
  },
  {
    name: "Growth Booster",
    price: "₱480.00",
    note: "For stronger young tree development.",
    stock: "Available",
    icon: "🪴",
  },
  {
    name: "Insecticide",
    price: "₱420.00",
    note: "Helps protect trees from harmful insects.",
    stock: "Available",
    icon: "🛡️",
  },
  {
    name: "Fungicide",
    price: "₱450.00",
    note: "For fungal prevention and treatment support.",
    stock: "Available",
    icon: "🍃",
  },
  {
    name: "Soil Conditioner",
    price: "₱390.00",
    note: "Improves soil quality around planted trees.",
    stock: "Available",
    icon: "🌾",
  },
  {
    name: "Tree Nutrients",
    price: "₱520.00",
    note: "General nutrient support for agarwood care.",
    stock: "Available",
    icon: "💧",
  },
  {
    name: "Disease Prevention Kit",
    price: "₱850.00",
    note: "Preventive package for common tree issues.",
    stock: "Limited",
    icon: "🧪",
  },
];

export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-[#061b12] p-8 text-[#f8e7b5]">
      <section className="rounded-[32px] border border-[#d6b76c]/30 bg-[radial-gradient(circle_at_top,#123f2b,#061b12_60%)] p-8 shadow-2xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-5 inline-block text-sm font-semibold text-[#d6b76c] hover:text-white"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="text-5xl font-bold text-[#f8e7b5]">
              Marketplace
            </h1>
            <p className="mt-2 text-lg italic text-[#d6b76c]">
              Premium Products for Healthy Agarwood Growth
            </p>
          </div>

          <div className="rounded-3xl border border-[#d6b76c]/40 bg-[#0b2b1c]/90 px-8 py-6 shadow-xl">
            <p className="text-xs font-bold tracking-widest text-[#d6b76c]">
              WALLET BALANCE
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[#f8e7b5]">
              ₱ 25,430.00
            </h2>
          </div>
        </div>

        <div className="mb-10 rounded-3xl border border-[#d6b76c]/30 bg-[#0b2b1c]/80 p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#d6b76c] text-4xl">
              🛒
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#f8e7b5]">
                Marketplace contains products only.
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-[#cabf9a]">
                Services like watering, photo update, GPS verification, and
                managed care subscription belong in Tree Operations.
              </p>
            </div>
          </div>
        </div>

        <h2 className="mb-6 text-2xl font-bold text-[#d6b76c]">
          Available Products
        </h2>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((item) => (
            <div
              key={item.name}
              className="group overflow-hidden rounded-3xl border border-[#d6b76c]/30 bg-[#082417]/90 p-5 shadow-xl transition hover:-translate-y-1 hover:border-[#f4d47d]"
            >
              <div className="mb-5 flex h-40 items-center justify-center rounded-2xl bg-gradient-to-br from-[#143d28] to-[#03150d] text-7xl shadow-inner">
                {item.icon}
              </div>

              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-2xl font-bold text-[#f8e7b5]">
                  {item.name}
                </h3>

                <span className="rounded-full bg-[#1b5133] px-3 py-1 text-xs font-bold text-[#d6b76c]">
                  {item.stock}
                </span>
              </div>

              <p className="min-h-[48px] text-sm text-[#cabf9a]">
                {item.note}
              </p>

              <div className="mt-6 text-3xl font-bold text-[#f4d47d]">
                {item.price}
              </div>

              <button className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#315f33] to-[#1f7a43] px-4 py-3 text-sm font-bold text-[#f8e7b5] shadow-lg transition hover:from-[#3f7a42] hover:to-[#24a85b]">
                🛒 Add to Inventory
              </button>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}