import { INTRO_DAY_KEY, INTRO_PENDING_ATTR } from "@/lib/intro";

/**
 * Pre-paint intro gate.
 *
 * The app shell server-renders fully, so without this the browser paints the
 * chrome, then hydrates, then the intro overlay appears an effect later —
 * you see the app for a beat before the video starts. This runs synchronously
 * during HTML parse and marks <html> so the cover in globals.css hides the
 * shell from the very first frame.
 *
 * It duplicates the gate in lib/intro.ts on purpose: it has to be inlined as
 * a string to run before paint, and it must NOT set the attribute when the
 * intro won't play (otherwise the cover would strand a black screen).
 * Mounted only under app/(app) — never on /login, which has no intro.
 */
const SCRIPT = `(function(){try{
var m=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if(m)return;
var d=new Date();
var k=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
var seen=null;try{seen=localStorage.getItem(${JSON.stringify(INTRO_DAY_KEY)})}catch(e){}
if(seen===k)return;
document.documentElement.setAttribute(${JSON.stringify(INTRO_PENDING_ATTR)},"");
}catch(e){}})();`;

export function IntroPreflight() {
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
