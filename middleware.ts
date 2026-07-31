import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except Next internals, images, ffmpeg.wasm
     * assets, and the boot-intro video (public/intro/, unauthenticated by
     * definition since it plays before sign-in is known).
     */
    "/((?!_next/static|_next/image|favicon.ico|ffmpeg/|intro/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm|mp4|webm)$).*)",
  ],
};
