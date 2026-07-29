/**
 * Shared Spectra prismatic-lines GLSL.
 * Accumulation math is the visual identity — do not rewrite.
 * Uniforms default to values that reproduce the original output exactly.
 */

export const VERTEX_SHADER = `
  void main() {
    gl_Position = vec4( position, 1.0 );
  }
`;

/**
 * Defaults:
 *   uSpeed     = 0.06
 *   uIntensity = 0.0008
 *   uWarmth    = 0.0
 *   uSeed      = 0.0
 *   uIce/uAmber/uWhite = Spectra role colours (#7FB4FF / #FFB56B / #FFFFFF)
 *
 * Accumulation math is unchanged. The final assignment remaps the cool /
 * mid / warm accumulators onto the artist's ice → white → amber so the
 * field follows the active palette (see artist-theme.ts).
 */
export const FRAGMENT_SHADER = `
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform float uWarmth;
      uniform float uSeed;
      uniform vec3 uIce;
      uniform vec3 uAmber;
      uniform vec3 uWhite;
        
      float random (in float x) {
          return fract(sin(x)*1e4);
      }
      float random (vec2 st) {
          return fract(sin(dot(st.xy,
                               vec2(12.9898,78.233)))*
              43758.5453123);
      }
      
      varying vec2 vUv;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        
        vec2 fMosaicScal = vec2(4.0, 2.0);
        vec2 vScreenSize = vec2(256,256);
        uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
        uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);       
          
        float t = time*uSpeed+random(uv.x + uSeed)*0.4;
        float lineWidth = uIntensity;

        vec3 color = vec3(0.0);
        for(int j = 0; j < 3; j++){
          for(int i=0; i < 5; i++){
            color[j] += lineWidth*float(i*i) / abs(fract(t - (0.01 + uWarmth*0.008)*float(j)+float(i)*0.01)*1.0 - length(uv));        
          }
        }

        // cool → ice, mid → white, warm → amber (accumulation above untouched)
        vec3 outColor = color[0] * uIce + color[1] * uWhite + color[2] * uAmber;
        gl_FragColor = vec4(outColor, 1.0);
      }
    `;

/** Spectra ice / amber / white as 0–1 RGB triples (UI tokens — not the
 * original shader channel basis; see ORIGINAL_* below). */
export const SPECTRA_ICE_RGB: [number, number, number] = [
  127 / 255,
  180 / 255,
  255 / 255,
];
export const SPECTRA_AMBER_RGB: [number, number, number] = [
  255 / 255,
  181 / 255,
  107 / 255,
];
export const SPECTRA_WHITE_RGB: [number, number, number] = [1, 1, 1];

/**
 * Channel basis that makes `color[0]*uIce + color[1]*uWhite + color[2]*uAmber`
 * identical to the original `vec4(color[2], color[1], color[0], 1.0)`.
 * Used for the Spectra (default) palette so the field matches classic TEMPO.
 */
export const ORIGINAL_COOL_RGB: [number, number, number] = [0, 0, 1];
export const ORIGINAL_MID_RGB: [number, number, number] = [0, 1, 0];
export const ORIGINAL_WARM_RGB: [number, number, number] = [1, 0, 0];

export const LIGHTFIELD_DEFAULTS: {
  uSpeed: number;
  uIntensity: number;
  uWarmth: number;
  uSeed: number;
  uIce: [number, number, number];
  uAmber: [number, number, number];
  uWhite: [number, number, number];
} = {
  uSpeed: 0.06,
  uIntensity: 0.0008,
  uWarmth: 0.0,
  uSeed: 0.0,
  uIce: ORIGINAL_COOL_RGB,
  uAmber: ORIGINAL_WARM_RGB,
  uWhite: ORIGINAL_MID_RGB,
};
