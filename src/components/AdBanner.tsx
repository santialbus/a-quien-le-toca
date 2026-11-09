
"use client";

import { useEffect } from "react";

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
  return (
    <aside className="w-full mt-2" aria-label="Publicidad">
      <p className="text-[10px] text-zinc-500 text-center mb-2">
        PUBLICIDAD
      </p>

      <div className="w-full min-h-[90px] rounded-xl border border-dashed border-white/20 bg-white/[0.03] flex flex-col items-center justify-center">
        <p className="text-sm font-bold text-zinc-300">
          ESPACIO RESERVADO
        </p>
        <p className="text-xs text-zinc-500">
          Aquí aparecerá tu anuncio
        </p>
      </div>
    </aside>
  );
}