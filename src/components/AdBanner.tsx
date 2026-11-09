
"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

/*export default function AdBanner() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

  useEffect(() => {
    if (!client || !slot) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error("Error al cargar AdSense:", error);
    }
  }, [client, slot]);

  if (!client || !slot) return null;

  return (
    <aside className="w-full mt-8" aria-label="Publicidad">
      <p className="text-[10px] text-zinc-600 text-center mb-2">
        PUBLICIDAD
      </p>

      <div className="w-full min-h-[90px] flex justify-center">
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%" }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
*/

export default function AdBanner() {
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsPwa(standalone);
  }, []);

  return (
    <aside
      className={`w-full ${isPwa ? "mt-0" : "mt-2"}`}
      aria-label="Publicidad"
    >
      <p
        className={`text-[9px] text-zinc-500 text-center ${
          isPwa ? "mb-0" : "mb-2"
        }`}
      >
        PUBLICIDAD
      </p>

      <div
        className={`w-full rounded-lg border border-dashed border-white/20 bg-white/[0.03] flex items-center justify-center ${
          isPwa ? "h-[24px]" : "min-h-[90px] flex-col"
        }`}
      >
        <p className="text-[10px] font-bold text-zinc-400">
          {isPwa ? "PUBLICIDAD" : "ESPACIO RESERVADO"}
        </p>

        {!isPwa && (
          <p className="text-xs text-zinc-500">
            Aquí aparecerá tu anuncio
          </p>
        )}
      </div>
    </aside>
  );
}