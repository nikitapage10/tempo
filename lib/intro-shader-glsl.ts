/**
 * Boot-intro dispersion-melt GLSL.
 *
 * Renders the intro video texture, cover-fit to the viewport. At `uMelt == 0`
 * this is an exact passthrough of the video — no visible seam between the
 * <video> element and the shader taking over. As `uMelt` ramps 0 -> 1 the
 * frame shatters into vertical columns, smears outward along Y, gets pushed
 * radially away from centre, and splits into RGB-fringed streaks (matching
 * the prism fringing already present in the source footage) before fading.
 *
 * Used only by components/intro-moment.tsx, for ~1s once per day. Not part
 * of the always-on root Lightfield — see lib/shader-glsl.ts for that.
 */

export const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uTex;
  uniform float uMelt;
  uniform vec2 uResolution;
  uniform float uTexAspect;
  uniform float uTime;

  varying vec2 vUv;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  // Cover-fit uv: scale the [0,1] video rect to fill uResolution without
  // distortion, cropping the overflow axis.
  vec2 coverUv(vec2 uv) {
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 scale = vec2(1.0);
    if (screenAspect > uTexAspect) {
      scale.y = uTexAspect / screenAspect;
    } else {
      scale.x = screenAspect / uTexAspect;
    }
    return (uv - 0.5) * scale + 0.5;
  }

  vec4 sampleMelt(vec2 uv, float melt) {
    vec2 centered = uv - 0.5;

    // Column shatter: hash a per-band velocity so the frame breaks along
    // vertical bars rather than blurring uniformly.
    float bands = 90.0;
    float band = floor(uv.x * bands);
    float bandVel = hash(band + 11.0) * 2.0 - 1.0;

    // Vertical streak smear, accumulated over a few taps.
    vec2 smearUv = uv;
    smearUv.y += melt * bandVel * 0.16;

    // Radial outward push riding the aperture the footage is already opening.
    vec2 pushed = centered * (1.0 + melt * 0.55) + 0.5;
    pushed.y = smearUv.y + (pushed.x - uv.x);

    // RGB dispersion: sample each channel at a slightly different push
    // distance, scaled by distance from centre.
    float dist = length(centered);
    float disp = melt * dist * 0.05;
    vec2 dir = normalize(centered + 1e-5);

    vec2 uvR = pushed + dir * disp * 1.6;
    vec2 uvG = pushed + dir * disp * 1.0;
    vec2 uvB = pushed + dir * disp * 0.4;

    float r = texture2D(uTex, coverUv(uvR)).r;
    float g = texture2D(uTex, coverUv(uvG)).g;
    float b = texture2D(uTex, coverUv(uvB)).b;

    return vec4(r, g, b, 1.0);
  }

  void main(void) {
    vec4 texel = sampleMelt(vUv, uMelt);
    float fade = 1.0 - smoothstep(0.55, 1.0, uMelt);
    gl_FragColor = vec4(texel.rgb * fade, 1.0);
  }
`;
