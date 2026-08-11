/**
 * "ATC" — a raymarched flow field, WebGL2 / GLSL ES 3.00.
 *
 * Standalone from lib/shader-glsl.ts (the root Spectra lightfield): this one
 * is a per-surface backdrop mounted only where a page asks for it. See
 * components/atc-backdrop.tsx.
 *
 * The fragment shader is a golf-style one-liner expanded into a loop, kept as
 * written. Two things about it drive the component around it:
 *
 *   - It needs WebGL2. There is no WebGL1 path — `#version 300 es`, `out`,
 *     and `layout(location=…)` have no equivalent worth back-porting, so the
 *     component falls back to the still gradient instead.
 *   - Each pixel runs 50 iterations of the march. That is a real per-frame
 *     cost at full resolution, which is why the component caps how many
 *     pixels it renders rather than only capping devicePixelRatio.
 */

export const ATC_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos,0.0,1.0); }`;

export const ATC_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  u_res;
uniform float u_time;

// robust tanh fallback
float tanh1(float x){ float e = exp(2.0*x); return (e-1.0)/(e+1.0); }
vec4 tanh4(vec4 v){ return vec4(tanh1(v.x), tanh1(v.y), tanh1(v.z), tanh1(v.w)); }

void main(){
  vec3 FC = vec3(gl_FragCoord.xy, 0.0);
  vec3 r  = vec3(u_res, max(u_res.x, u_res.y));
  float t = u_time;

  vec4 o = vec4(0.0);

  // === your code with safe inits & valid mat2 multiply, tanh replacement ===
  vec3 p = vec3(0.0);
  vec3 v = vec3(1.0, 2.0, 6.0);
  float i = 0.0, z = 1.0, d = 1.0, f = 1.0;

  for ( ; i++ < 5e1;
        o.rgb += (cos((p.x + z + v) * 0.1) + 1.0) / d / f / z )
  {
    p = z * normalize(FC * 2.0 - r.xyy);

    vec4 m = cos((p + sin(p)).y * 0.4 + vec4(0.0, 33.0, 11.0, 0.0));
    p.xz = mat2(m) * p.xz;

    p.x += t / 0.2;

    z += ( d = length(cos(p / v) * v + v.zxx / 7.0) /
           ( f = 2.0 + d / exp(p.y * 0.2) ) );
  }

  o = tanh4(0.2 * o);
  o.a = 1.0;
  fragColor = o;
}`;
