import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except Next internals, images, ffmpeg.wasm
     * assets, the boot-intro video (public/intro/, unauthenticated by
     * definition since it plays before sign-in is known), Origin media
     * (public/onboarding/ — login uses the Tempo Theme bed before auth),
     * and desktop installers (public/downloads/) — a shared download link
     * has to work for someone with no TEMPO session at all.
     */
    "/((?!_next/static|_next/image|favicon.ico|ffmpeg/|intro/|onboarding/|downloads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm|mp4|webm|mp3|m4a)$).*)",
  ],
};
