# ¿A quién le toca? — PWA beta

Aplicación Next.js App Router + TypeScript + Tailwind CSS + Firebase Authentication (anónimo) + Cloud Firestore.

## Incluye
- Salas con código compartible y miembros.
- Tareas predeterminadas y personalizadas por sala.
- Sorteo animado, ticks y fanfarria sintéticos con Web Audio API.
- Multas económicas y retos.
- Ranking mensual de multas por participante.
- Suscripciones Firestore en tiempo real.
- Diseño oscuro mobile-first y manifest PWA.

## Requisitos
Node.js 20.9+ y un proyecto Firebase.

## Arranque local
```bash
npm install
cp .env.example .env.local
# Rellena NEXT_PUBLIC_FIREBASE_* con la configuración de tu app web
npm run dev
```
Abre http://localhost:3000.

## Firebase (pasos)
1. Firebase Console → crea proyecto → añade aplicación Web.
2. Authentication → Sign-in method → activa **Anonymous**.
3. Firestore Database → crea base de datos (elige región cercana a tus usuarios).
4. Firestore → Rules → pega el contenido de `firestore.rules` y publica.
5. En Project settings → Your apps → SDK setup and configuration copia los valores al `.env.local`.
6. Para salas compartidas, el código de grupo funciona como invitación: compártelo solo con las personas que deban entrar.

## Vercel
1. Sube el proyecto a GitHub.
2. Vercel → Add New → Project → importa el repositorio.
3. Framework preset: Next.js (detección automática).
4. Settings → Environment Variables: añade las seis variables `NEXT_PUBLIC_FIREBASE_*`.
5. Deploy. Cada cambio en la rama conectada desplegará una nueva versión.

## Modelo Firestore
```text
groups/{groupId}
  name, ownerId, createdAt
  members/{uid}
    uid, name, joinedAt
  tasks/{taskId}
    title, createdAt
  penalties/{penaltyId}
    targetUid, targetName, type, amount?, description, createdBy, createdAt
  draws/{drawId}
    winnerUid, winnerName, taskTitle, createdBy, createdAt
```
`groupId` es un código corto aleatorio de 6 caracteres. Las colecciones anidadas evitan tener que mantener arrays crecientes en el documento principal y permiten listeners independientes.

## Comprobaciones antes de beta pública
- Probar crear sala en un móvil y unirse desde otro.
- Verificar listeners en tiempo real.
- Probar reglas con Firebase Emulator Suite / Rules Playground.
- Configurar App Check antes de abrir el acceso ampliamente.
- Añadir moderación/consentimiento para expulsiones y multas; actualmente cualquier miembro puede registrar una multa y el autor puede borrarla.
- El ranking filtra las multas por mes natural actual.
- La autenticación anónima identifica el dispositivo/navegador, no una persona. Si se borran datos del navegador puede cambiar el UID.
- El manifest permite instalación PWA; para experiencia completa iOS/Android, añadir iconos 192/512 y probar instalación en dispositivos reales.

## Limitaciones beta conocidas
- Los grupos creados se muestran en “Mis grupos” del propietario. La última sala activa se conserva en el navegador mediante localStorage; el miembro puede volver a abrirla en ese mismo dispositivo.
- La ruleta usa una animación circular decorativa y un sorteo aleatorio uniforme real; no es una ruleta segmentada con etiquetas por persona.
- No se incluye backend privilegiado. La seguridad se aplica con reglas Firestore, no ocultando la configuración web.
